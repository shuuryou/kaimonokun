declare var T_ALL_LISTS: string;
declare var T_WRITE_ITEM_TEXT: string;
declare var T_WRITE_LIST_TEXT: string;
declare var T_LIST_WAS_DELETED_TITLE: string;
declare var T_LIST_WAS_DELETED: string;
declare var T_AJAX_ERROR_TITLE: string;
declare var T_AJAX_ERROR_GENERIC_TEXT: string;
declare var T_EVENTSOURCE_ERROR_TITLE: string;
declare var T_EVENTSOURCE_ERROR_GENERIC_TEXT: string;

type TouchTargetCandidate =
{
	target: HTMLElement,
	startX: number,
	endX: number,
	startY: number,
	endY: number
}

enum UIModes {
	None = 0,
	Lists = 1 << 0,
	Items = 1 << 1,
	Loading = 1 << 2,
	AllowAdd = 1 << 3
}

class kaimonokun {
	private static readonly TOUCH_MIN_TIME_MS: number = 150;
	private static readonly DIGEST_LIST_NOT_EXIST: string = '0000000000';
	private static readonly BACKEND_LOCATION: string = 'backend.php';
	private static readonly EVENTSOURCE_LOCATION: string = 'monitor.php';

	// State
	private m_UIMode: UIModes;
	private m_CurrentListId: string | null;
	private m_CurrentDigest: string | null;

	// Touch drag/drop support for mobile
	private m_TouchMoved: boolean;
	private m_TouchTarget: HTMLElement | null;
	private m_TouchTargetCandidates: Array<TouchTargetCandidate>;
	private m_TouchTime: number; // For testing TOUCH_MIN_TIME_MS 

	// Backend communication
	private m_EventSource: EventSource | null;
	private m_AuthLine: string;

	// Remembers scroll position for restore after closing modal errors
	private m_PreModalScrollPos: [number, number] | null;

	// State
	private m_IsEditing: boolean;
	private m_UpdatePending: boolean;

	constructor(authline: string) {
		this.m_TouchMoved = false;
		this.m_TouchTarget = null;
		this.m_TouchTargetCandidates = [];
		this.m_TouchTime = -1;

		this.m_UIMode = UIModes.None;

		this.m_CurrentListId = null;
		this.m_CurrentDigest = null;

		this.m_EventSource = null;
		this.m_AuthLine = authline;

		this.m_PreModalScrollPos = null;

		this.m_IsEditing = false;
		this.m_UpdatePending = false;

		if (document.readyState != "loading")
			this.initialize();
		else
			document.addEventListener("DOMContentLoaded", (ev) => this.initialize());
	}

	private initialize() {
		this.UIMode = UIModes.None;

		{
			let el = document.querySelector('div.head a.addtogglebutton') as HTMLElement;
			if (el == null) throw 'Add toggle button missing.';
			el.addEventListener('click', (ev) => this.toggleAdd());
		}

		{
			let el = document.querySelector('div.head a.sortbutton') as HTMLElement;
			if (el == null) throw 'Sort button missing.';
			el.addEventListener('click', (ev) => this.sortItems());
		}

		{
			let el = document.querySelector('div.head a.backbutton') as HTMLElement;
			if (el == null) throw 'Back button missing.';
			el.addEventListener('click', (ev) => this.loadLists(false));
		}

		{
			let el = document.querySelector('div.add > input') as HTMLElement;
			if (el == null) throw 'Add input element missing.';
			el.addEventListener('keyup', (ev) => this.handleAddKeyUp(ev));
		}

		window.addEventListener('beforeunload', (ev) => this.handleBeforeUnload());
		window.addEventListener('visibilitychange', (ev) => this.handleVisibilityChange());

		this.loadLists(false);
	}

	private toggleAdd() {
		this.UIMode ^= UIModes.AllowAdd;

		if ((this.UIMode & UIModes.AllowAdd) === UIModes.AllowAdd) {
			let el = document.querySelector('div.add > input') as HTMLElement;
			el.focus();
		}
	}

	private sortItems() {
		if (this.m_CurrentListId == null)
			return;

		this.UIMode = UIModes.Loading;

		this.destroyEventSource();

		let postData: FormData = new FormData();
		postData.append('what', 'sortitems');
		postData.append('listid', this.m_CurrentListId);

		let requestOptions: RequestInit =
		{
			method: 'POST',
			mode: 'same-origin',
			body: postData
		};

		fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
			.then(async response => {
				const ret: string = await response.text();

				if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
					this.showModal(T_AJAX_ERROR_TITLE, ret);
					return;
				}

			})
			.catch(error => {
				this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
				return;
			});

		this.loadItems(false, this.m_CurrentListId);
	}

	private loadLists(sneaky: boolean) {
		this.destroyEventSource();

		this.m_UpdatePending = false;
		this.m_IsEditing = false;

		if (!sneaky)
			this.UIMode = UIModes.Loading;

		this.m_CurrentListId = null;

		document.querySelector('h1')!.innerText = T_ALL_LISTS;
		document.querySelector('div.add > input')!.setAttribute("placeholder", T_WRITE_LIST_TEXT);

		let postData: FormData = new FormData();
		postData.append('what', 'lists');

		let requestOptions: RequestInit =
		{
			method: 'POST',
			mode: 'same-origin',
			body: postData
		};

		fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
			.then(async response => {
				const ret: string = await response.text();

				if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
					this.showModal(T_AJAX_ERROR_TITLE, ret);
					return;
				}

				this.m_CurrentDigest = ret.substring(2, 12);

				const data: object = JSON.parse(ret.substring(12));
				const items: HTMLElement = document.querySelector('#lists')! as HTMLElement;
				const newitems: DocumentFragment = document.createDocumentFragment();

				for (var id in data)
					if (data.hasOwnProperty(id))
						newitems.append(this.makeList(id, data[id as keyof typeof data] as string));

				while (items.lastChild)
					items.removeChild(items.lastChild);

				items.appendChild(newitems);

				if (!sneaky)
					this.UIMode = UIModes.Lists;

				this.createEventSource();
			})
			.catch(error => {
				this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
				return;
			});
	}

	private loadItems(sneaky: boolean, listId: string) {
		this.destroyEventSource();

		this.m_UpdatePending = false;
		this.m_IsEditing = false;

		if (!sneaky)
			this.UIMode = UIModes.Loading;

		this.m_CurrentListId = listId;

		document.querySelector('div.add > input')!.setAttribute('placeholder', T_WRITE_ITEM_TEXT);

		let postData: FormData = new FormData();
		postData.append('what', 'getitems');
		postData.append('listid', this.m_CurrentListId);

		let requestOptions: RequestInit =
		{
			method: 'POST',
			mode: 'same-origin',
			body: postData
		};

		fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
			.then(async response => {
				const ret: string = await response.text();

				if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
					this.showModal(T_AJAX_ERROR_TITLE, ret);
					return;
				}

				this.m_CurrentDigest = ret.substring(2, 12);

				const data: object = JSON.parse(ret.substring(12));
				const items: HTMLElement = document.querySelector('#items')! as HTMLElement;
				const newitems: DocumentFragment = document.createDocumentFragment();

				for (var id in data)
					if (data.hasOwnProperty(id))
						newitems.appendChild(this.makeItem(id, data[id as keyof typeof data]['item'], data[id as keyof typeof data]['checked']));

				while (items.lastChild)
					items.removeChild(items.lastChild);

				items.appendChild(newitems);

				if (!sneaky)
					this.UIMode = UIModes.Items;

				this.createEventSource();
			})
			.catch(error => {
				this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
				return;
			});
	}

	private handleAddKeyUp(evt: KeyboardEvent) {
		if (evt === null) return;

		if (!(evt.target instanceof HTMLInputElement))
			return;

		if (evt.keyCode !== 13)
			return;

		evt.preventDefault();

		var input = evt.target;

		var val = input.value.trim();
		input.value = '';

		if (val == '') {
			this.toggleAdd();
			return;
		}

		if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
			let postData: FormData = new FormData();
			postData.append('what', 'newlist');
			postData.append('name', val);

			let requestOptions: RequestInit =
			{
				method: 'POST',
				mode: 'same-origin',
				body: postData
			};

			fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
				.then(async response => {
					const ret: string = await response.text();

					if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
						this.showModal(T_AJAX_ERROR_TITLE, ret);
						return;
					}

					this.m_CurrentDigest = ret.substring(2, 12);

					var id = ret.substring(12);
					const items: HTMLElement = document.querySelector('#lists')! as HTMLElement;
					items.appendChild(this.makeList(id, val));
				})
				.catch(error => {
					this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
					return;
				});

			return;
		}

		if ((this.UIMode & UIModes.Items) === UIModes.Items) {
			let postData: FormData = new FormData();
			postData.append('what', 'additem');
			postData.append('listid', this.m_CurrentListId!);
			postData.append('item', val);

			let requestOptions: RequestInit =
			{
				method: 'POST',
				mode: 'same-origin',
				body: postData
			};

			fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
				.then(async response => {
					const ret: string = await response.text();

					if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
						this.showModal(T_AJAX_ERROR_TITLE, ret);
						return;
					}

					this.m_CurrentDigest = ret.substring(2, 12);

					var id = ret.substring(12);
					const items: HTMLElement = document.querySelector('#items')! as HTMLElement;
					items.appendChild(this.makeItem(id, val, false));
				})
				.catch(error => {
					this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
					return;
				});

			return;
		}

		throw 'Invalid mode.';
	}

	private handleBeforeUnload() {
		this.destroyEventSource();
	}

	private handleVisibilityChange() {
		if (document.visibilityState != 'visible') {
			this.destroyEventSource();
			return;
		}

		this.createEventSource();
	}

	private createEventSource() {
		if (this.m_EventSource != null)
			return;

		if (document.visibilityState != 'visible')
			return;

		let watch;

		if ((this.UIMode & UIModes.Lists) === UIModes.Lists)
			watch = 'lists';
		else if ((this.UIMode & UIModes.Items) === UIModes.Items)
			watch = this.m_CurrentListId;
		else
			throw 'Invalid mode.';

		this.m_EventSource = new EventSource(kaimonokun.EVENTSOURCE_LOCATION + '?watch=' + watch + '&auth=' + this.m_AuthLine);
		this.m_EventSource.addEventListener('message', (ev) => this.eventSourceOnMessageImpl(ev));
		this.m_EventSource.addEventListener('error', () => this.eventSourceOnErrorImpl());
	}

	private destroyEventSource() {
		if (this.m_EventSource == null)
			return;

		this.m_EventSource.onerror = null;
		this.m_EventSource.close();
		this.m_EventSource = null;
	}

	private eventSourceOnErrorImpl() {
		if (this.m_EventSource === null)
			return;

		if (this.m_EventSource.readyState == EventSource.CONNECTING)
			return;

		if (this.m_EventSource.readyState == EventSource.CLOSED) {
			this.showModal(T_EVENTSOURCE_ERROR_TITLE, T_EVENTSOURCE_ERROR_GENERIC_TEXT);
			return;
		}
	}

	private eventSourceOnMessageImpl(e: MessageEvent) {
		var digest = e.data.trim();

		if (this.m_CurrentDigest === digest) {
			console.log('EventSource: Remote digest %s is the same as ours, so ignore.', digest);
			return;
		}

		console.log('EventSource: Remote digest is %s and ours is %s.', digest, this.m_CurrentDigest);
		this.m_CurrentDigest = digest;

		if (this.m_IsEditing) {
			console.log('Defer processing while some editing in progress.');
			this.m_UpdatePending = true;
		}

		if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
			this.loadLists(true);
			return;
		}

		if ((this.UIMode & UIModes.Items) === UIModes.Items) {
			if (this.m_CurrentDigest === kaimonokun.DIGEST_LIST_NOT_EXIST) {
				this.loadLists(false);
				this.showModal(T_LIST_WAS_DELETED_TITLE, T_LIST_WAS_DELETED);
				return;
			}

			this.loadItems(true, this.m_CurrentListId!);
			return;
		}

		throw 'Invalid mode.';
	}

	private makeList(listId: string, listName: string) {
		const tpl: HTMLTemplateElement = document.getElementById('tpl-list') as HTMLTemplateElement;
		const content: HTMLElement = (tpl.content.cloneNode(true) as HTMLElement).firstElementChild as HTMLElement;

		content.dataset['listid'] = listId;

		let el;

		el = content.querySelector('span')! as HTMLElement;
		el.innerText = listName;
		el.addEventListener('click', (ev) => this.handleClick(ev));

		el = content.querySelector('input')! as HTMLElement;
		el.style.display = 'none';
		el.addEventListener('keyup', (ev) => this.handleEditKeyUp(ev))

		el = content.querySelector('.save')! as HTMLElement;
		el.parentElement!.style.display = 'none';
		el.addEventListener('click', (ev) => this.handleSave(ev));

		el = content.querySelector('.edit')! as HTMLElement;
		el.addEventListener('click', (ev) => this.handleEdit(ev));

		el = content.querySelector('.erase')!;
		el.addEventListener('click', (ev) => this.handleErase(ev));

		return content;
	}

	private makeItem(itemId: string, text: string, checked: boolean) {
		const tpl: HTMLTemplateElement = document.getElementById('tpl-item') as HTMLTemplateElement;
		const content: HTMLElement = (tpl.content.cloneNode(true) as HTMLElement).firstElementChild as HTMLElement;

		content.dataset['itemid'] = itemId;
		content.dataset['checked'] = checked ? '1' : '0';

		content.addEventListener('dragstart', (ev) => this.handleDrag(ev));
		content.addEventListener('dragend', (ev) => this.handleDragEnd());
		content.addEventListener('dragenter', (ev) => this.handleDragEnter(ev));
		content.addEventListener('dragover', (ev) => this.handleDragOver(ev));

		let el;

		el = content.querySelector('span')! as HTMLElement;
		if (checked)
			el.classList.add('checked');
		el.innerText = text;
		el.addEventListener('click', (ev) => this.handleClick(ev));

		el = content.querySelector('input')! as HTMLElement;
		el.style.display = 'none';
		el.addEventListener('keyup', (ev) => this.handleEditKeyUp(ev))

		el = content.querySelector('.save')! as HTMLElement;
		el.parentElement!.style.display = 'none';
		el.addEventListener('click', (ev) => this.handleSave(ev));

		el = content.querySelector('.edit')! as HTMLElement;
		el.addEventListener('click', (ev) => this.handleEdit(ev));

		el = content.querySelector('.erase')! as HTMLElement;
		el.addEventListener('click', (ev) => this.handleErase(ev));

		el = content.querySelector('.sort')! as HTMLElement;
		el.addEventListener('touchstart', (ev) => this.handleTouch(ev));
		el.addEventListener('touchend', (ev) => this.handleTouchEnd());
		el.addEventListener('touchmove', (ev) => this.handleTouchMove(ev));

		return content;
	}

	private handleClick(evt: Event) {
		if (evt === null) return;

		if (!(evt.target instanceof HTMLElement))
			return;

		evt.preventDefault();

		let el = evt.target as HTMLElement;
		while (el && !el.classList.contains('item'))
			el = el.parentElement as HTMLElement;

		if (!el)
			return;

		if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
			const list_id = el.dataset['listid'] as string;
			const list_name = el.querySelector('span')!.innerText.trim();

			document.querySelector('h1')!.innerText = list_name;

			this.loadItems(false, list_id);

			return;
		}

		if ((this.UIMode & UIModes.Items) === UIModes.Items) {
			const item_id = el.dataset['itemid'] as string;

			let is_checked = el.dataset['checked'] === '1';
			is_checked = !is_checked;

			{
				let span = el.querySelector('span') as HTMLElement;
				if (is_checked) {
					el.dataset['checked'] = '1';
					span!.classList.add('checked');
				}
				else {
					el.dataset['checked'] = '0';
					span!.classList.remove('checked');
				}
			}

			let postData: FormData = new FormData();
			postData.append('what', 'checkitem');
			postData.append('listid', this.m_CurrentListId!);
			postData.append('id', item_id);
			postData.append('checked', is_checked ? 'T' : 'F');

			let requestOptions: RequestInit =
			{
				method: 'POST',
				mode: 'same-origin',
				body: postData
			};

			fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
				.then(async response => {
					const ret: string = await response.text();

					if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
						this.showModal(T_AJAX_ERROR_TITLE, ret);
						return;
					}

					this.m_CurrentDigest = ret.substring(2, 12);
				})
				.catch(error => {
					this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
					return;
				});

			return;
		}

		throw 'Invalid mode.';
	}

	private handleEdit(evt: Event) {
		if (evt === null) return;

		if (!(evt.target instanceof HTMLElement))
			return;

		evt.preventDefault();

		let el = evt.target as HTMLElement;
		while (el && !el.classList.contains('item'))
			el = el.parentElement as HTMLElement;

		if (!el)
			return;

		this.m_IsEditing = true;

		el.draggable = false; // Required to change caret position in input field

		let input = el.querySelector('input')! as HTMLInputElement;
		let span = el.querySelector('span')! as HTMLElement;

		input.value = span.innerText.trim();

		span.style.display = 'none';
		input.style.display = 'block';

		let el2;
		el2 = el.querySelector('.save')! as HTMLElement;
		el2.parentElement!.style.display = 'block';

		el2 = el.querySelector('.edit')! as HTMLElement;
		el2.parentElement!.style.display = 'none';

		el2 = el.querySelector('.erase')! as HTMLElement;
		el2.parentElement!.style.display = 'none';

		if (window.matchMedia('(max-width:48em)').matches) {
			el2 = el.querySelector('.sortcontainer')! as HTMLElement;
			el2.parentElement!.style.display = 'none';
		}

		input.focus();
	}

	private handleSave(evt: Event) {
		if (evt === null) return;

		if (!(evt.target instanceof HTMLElement))
			return;

		evt.preventDefault();

		let el = evt.target as HTMLElement;
		while (el && !el.classList.contains('item'))
			el = el.parentElement as HTMLElement;

		if (!el)
			return;

		el.draggable = true; // Was turned to false in handleEdit

		let input = el.querySelector('input')! as HTMLInputElement;
		let span = el.querySelector('span')! as HTMLElement;

		const oldtext = span.innerText.trim();
		const newtext = input.value.trim();

		// if (newtext.length == 0 || oldtext == newtext)
		//     goto done; // haha, you wish this language was sane :(

		if (newtext.length != 0 && oldtext != newtext) {
			if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
				const list_id = el.dataset['listid'] as string;

				let postData: FormData = new FormData();
				postData.append('what', 'renlist');
				postData.append('id', list_id);
				postData.append('newname', newtext);

				let requestOptions: RequestInit =
				{
					method: 'POST',
					mode: 'same-origin',
					body: postData
				};

				fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
					.then(async response => {
						const ret: string = await response.text();

						if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
							this.showModal(T_AJAX_ERROR_TITLE, ret);
							return;
						}
					})
					.catch(error => {
						this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
						return;
					});
			}
			else if ((this.UIMode & UIModes.Items) === UIModes.Items) {
				const item_id = el.dataset['itemid'] as string;

				let postData: FormData = new FormData();
				postData.append('what', 'renitem');
				postData.append('listid', this.m_CurrentListId!);
				postData.append('id', item_id);
				postData.append('newitem', newtext);

				let requestOptions: RequestInit =
				{
					method: 'POST',
					mode: 'same-origin',
					body: postData
				};

				fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
					.then(async response => {
						const ret: string = await response.text();

						if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
							this.showModal(T_AJAX_ERROR_TITLE, ret);
							return;
						}
					})
					.catch(error => {
						this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
						return;
					});
			}
			else throw 'Invalid mode.';
		}

		// done:

		span.innerText = newtext;

		input.style.display = 'none';
		span.style.display = 'block';

		let el2;
		el2 = el.querySelector('.save')! as HTMLElement;
		el2.parentElement!.style.display = 'none';

		el2 = el.querySelector('.edit')! as HTMLElement;
		el2.parentElement!.style.display = 'block';

		el2 = el.querySelector('.erase')! as HTMLElement;
		el2.parentElement!.style.display = 'block';

		if (window.matchMedia('(max-width:48em)').matches) {
			el2 = el.querySelector('.sortcontainer')! as HTMLElement;
			el2.parentElement!.style.display = 'block';
		}

		this.m_IsEditing = false;

		if (!this.m_UpdatePending)
			return;

		if ((this.UIMode & UIModes.Lists) === UIModes.Lists)
			this.loadLists(true);
		else if ((this.UIMode & UIModes.Items) === UIModes.Items)
			this.loadItems(true, this.m_CurrentListId!);
		else throw 'Invalid mode.';
	}

	private handleEditKeyUp(evt: KeyboardEvent) {
		if (evt === null) return;

		if (!(evt.target instanceof HTMLElement))
			return;

		if (evt.keyCode !== 13)
			return;

		evt.preventDefault();
		this.handleSave(evt);
	}

	private handleErase(evt: Event) {
		if (evt === null) return;

		if (!(evt.target instanceof HTMLElement))
			return;

		evt.preventDefault();

		let el = evt.target as HTMLElement;
		while (el && !el.classList.contains('item'))
			el = el.parentElement as HTMLElement;

		if (!el)
			return;

		if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
			const list_id = el.dataset['listid']! as string;

			let postData: FormData = new FormData();
			postData.append('what', 'dellist');
			postData.append('id', list_id);

			let requestOptions: RequestInit =
			{
				method: 'POST',
				mode: 'same-origin',
				body: postData
			};

			fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
				.then(async response => {
					const ret: string = await response.text();

					if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
						this.showModal(T_AJAX_ERROR_TITLE, ret);
						return;
					}

					el.remove();
				})
				.catch(error => {
					this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
					return;
				});
		}
		else if ((this.UIMode & UIModes.Items) === UIModes.Items) {
			const item_id = el.dataset['itemid']! as string;

			let postData: FormData = new FormData();
			postData.append('what', 'delitem');
			postData.append('listid', this.m_CurrentListId!);
			postData.append('id', item_id);

			let requestOptions: RequestInit =
			{
				method: 'POST',
				mode: 'same-origin',
				body: postData
			};

			fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
				.then(async response => {
					const ret: string = await response.text();

					if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
						this.showModal(T_AJAX_ERROR_TITLE, ret);
						return;
					}

					el.remove();
				})
				.catch(error => {
					this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
					return;
				});
		}
		else throw 'Invalid mode.';
	}

	private handleDrag(evt: DragEvent) {
		if (evt === null) return;

		evt.dataTransfer!.effectAllowed = 'move';

		this.m_TouchTarget = evt.target as HTMLElement;
		this.m_TouchTarget.classList.add('onDrag');
	}

	private handleDragEnd() {
		if (this.m_TouchTarget == null) return;

		this.m_TouchTarget.classList.remove('onDrag');

		let new_order: string = '';

		document.querySelectorAll('div#items>div.item').forEach(function (el: Element) { new_order += (el as HTMLElement).dataset['itemid'] + '/'; });
		new_order = new_order.slice(0, -1);

		let postData: FormData = new FormData();
		postData.append('what', 'changesort');
		postData.append('listid', this.m_CurrentListId!);
		postData.append('neworder', new_order);

		let requestOptions: RequestInit =
		{
			method: 'POST',
			mode: 'same-origin',
			body: postData
		};

		fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
			.then(async response => {
				const ret: string = await response.text();

				if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
					this.showModal(T_AJAX_ERROR_TITLE, ret);
					return;
				}

				this.m_CurrentDigest = ret.substring(2, 12);
			})
			.catch(error => {
				this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
				return;
			});

		this.m_TouchTarget = null;
	}

	private handleDragOver(evt: DragEvent) {
		if (evt === null) return;
		if (this.m_TouchTarget == null) return;

		// Can only drag over item containers, not their children
		if ((evt.target as HTMLElement).id != 'list')
			return;

		evt.dataTransfer!.dropEffect = 'move';
		evt.preventDefault();
	}

	private handleDragEnter(evt: DragEvent) {
		if (evt === null) return;
		if (this.m_TouchTarget == null) return;

		const target_el: HTMLElement = evt.target as HTMLElement;

		// Can only enter item contaienrs, not their children
		if (!target_el.classList.contains('list'))
			return;

		evt.dataTransfer!.dropEffect = 'move';

		target_el.insertBefore(this.m_TouchTarget, target_el);
		evt.preventDefault();
	}

	private handleTouch(evt: TouchEvent) {
		if (evt === null) return;

		this.m_TouchMoved = false;
		this.m_TouchTime = Date.now();

		let el: HTMLElement = evt.target as HTMLElement;

		// Finger was not on the item container but on one of its children, so walk up the DOM tree
		while (el && !el.classList.contains('item'))
			el = el.parentNode as HTMLElement;

		if (!el)
			return; // No item container, WTF?

		// Found the item container!
		this.m_TouchTarget = el;

		// Define valid destinations for dragging over
		let ttcs: Array<TouchTargetCandidate> = [ ];

		document.querySelectorAll('div#items>div.item').forEach(function (el: Element) {
			const hel = el as HTMLElement;

			const o: TouchTargetCandidate =
			{
				target: hel,
				startX: hel.offsetLeft,
				endX: hel.offsetLeft + hel.offsetWidth,
				startY: hel.offsetTop,
				endY: hel.offsetTop + hel.offsetHeight
            }

			ttcs.push(o);
		});

		this.m_TouchTargetCandidates = ttcs;
	}

	private handleTouchEnd() {
		if (this.m_TouchTarget === null) return;

		if (!this.m_TouchMoved || (Date.now() - this.m_TouchTime) < kaimonokun.TOUCH_MIN_TIME_MS)
			return;

		this.m_TouchTarget.classList.remove('onDrag');
		this.handleDragEnd();
	}

	private handleTouchMove(evt: TouchEvent) {
		if (evt === null) return;
		if (this.m_TouchTarget === null) return;

		if ((Date.now() - this.m_TouchTime) < kaimonokun.TOUCH_MIN_TIME_MS)
			return;

		if (!this.m_TouchMoved) {
			// First movement of finger
			this.m_TouchTarget.classList.add('onDrag');
			this.m_TouchMoved = true;
		}

		if (evt.changedTouches.length == 0) return;

		const client_x: number = evt.changedTouches[0]!.pageX;
		const client_y: number = evt.changedTouches[0]!.pageY;

		const tt = this.m_TouchTarget;

		this.m_TouchTargetCandidates.some(function (item) {
			if (client_x < item.startX || client_x > item.endX || client_y < item.startY || client_y > item.endY)
				return false;

			item.target.before(tt, item.target);
			return true;
		});
	}

	private get UIMode(): UIModes { return this.m_UIMode; }

	private set UIMode(mode: UIModes) {
		let candidates: { [key: string]: boolean } =
		{
			'div#content': (mode !== UIModes.None),
			'div#loading': (mode & UIModes.Loading) === UIModes.Loading,
			'div#lists': (mode & UIModes.Lists) === UIModes.Lists,
			'div#items': (mode & UIModes.Items) === UIModes.Items,
			'div.add': (mode & UIModes.AllowAdd) === UIModes.AllowAdd
		};

		for (let id in candidates) {
			let el = document.querySelector(id) as HTMLElement;
			let visible = candidates[id];
			el!.style.display = visible ? "block" : "none";
		}

		const isItems: boolean = ((mode & UIModes.Items) == UIModes.Items);
		document.querySelector('div.head a.backbutton')!.parentElement!.style.display = isItems ? 'block' : 'none';
		document.querySelector('div.head a.sortbutton')!.parentElement!.style.display = isItems ? 'block' : 'none';

		this.m_UIMode = mode;
	}

	public showModal(title: string, text: string) {
		this.m_PreModalScrollPos = [window.scrollX, window.scrollY];
		window.scrollTo(0, 0);

		(document.querySelector('#modaltitle')! as HTMLElement).innerText = title;
		(document.querySelector('#modalcontent')! as HTMLElement).innerText = text;

		(document.querySelector('#content')! as HTMLElement).classList.add('blur');
		document.body.classList.add('modal');

		(document.querySelector('#modal')! as HTMLElement).style.display = 'block';
		(document.querySelector('#modalbutton')! as HTMLElement).focus();
	}

	public closeModal() {
		(document.querySelector('#modal')! as HTMLElement).style.display = 'none';
		(document.querySelector('#content')! as HTMLElement).classList.remove('blur');
		document.body.classList.remove('modal');

		if (this.m_PreModalScrollPos != null)
			window.scrollTo(this.m_PreModalScrollPos[0], this.m_PreModalScrollPos[1]);
	}
}
