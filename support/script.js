"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var UIModes;
(function (UIModes) {
    UIModes[UIModes["None"] = 0] = "None";
    UIModes[UIModes["Lists"] = 1] = "Lists";
    UIModes[UIModes["Items"] = 2] = "Items";
    UIModes[UIModes["Loading"] = 4] = "Loading";
    UIModes[UIModes["AllowAdd"] = 8] = "AllowAdd";
})(UIModes || (UIModes = {}));
class kaimonokun {
    constructor(authline) {
        this.m_TouchMoved = false;
        this.m_DragTarget = null;
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
        if (document.readyState != 'loading')
            this.initialize();
        else
            document.addEventListener('DOMContentLoaded', (ev) => this.initialize());
    }
    initialize() {
        this.UIMode = UIModes.None;
        {
            let el = document.querySelector('div.head a.addtogglebutton');
            if (el == null)
                throw 'Add toggle button missing.';
            el.addEventListener('click', (ev) => this.toggleAdd());
        }
        {
            let el = document.querySelector('div.head a.sortbutton');
            if (el == null)
                throw 'Sort button missing.';
            el.addEventListener('click', (ev) => this.sortItems());
        }
        {
            let el = document.querySelector('div.head a.backbutton');
            if (el == null)
                throw 'Back button missing.';
            el.addEventListener('click', (ev) => this.loadLists(false));
        }
        {
            let el = document.querySelector('div.add > input');
            if (el == null)
                throw 'Add input element missing.';
            el.addEventListener('keyup', (ev) => this.handleAddKeyUp(ev));
        }
        window.addEventListener('beforeunload', (ev) => this.handleBeforeUnload());
        window.addEventListener('visibilitychange', (ev) => this.handleVisibilityChange());
        this.loadLists(false);
    }
    toggleAdd() {
        this.UIMode ^= UIModes.AllowAdd;
        if ((this.UIMode & UIModes.AllowAdd) === UIModes.AllowAdd) {
            let el = document.querySelector('div.add > input');
            el.focus();
        }
    }
    sortItems() {
        if (this.m_CurrentListId == null)
            return;
        this.UIMode = UIModes.Loading;
        this.destroyEventSource();
        let postData = new FormData();
        postData.append('what', 'sortitems');
        postData.append('listid', this.m_CurrentListId);
        let requestOptions = {
            method: 'POST',
            mode: 'same-origin',
            body: postData,
        };
        fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
            .then((response) => __awaiter(this, void 0, void 0, function* () {
            const ret = yield response.text();
            if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
                this.showModal(T_AJAX_ERROR_TITLE, ret);
                return;
            }
        }))
            .catch((error) => {
            this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
            return;
        });
        this.loadItems(false, this.m_CurrentListId);
    }
    loadLists(sneaky) {
        this.destroyEventSource();
        this.m_UpdatePending = false;
        this.m_IsEditing = false;
        if (!sneaky)
            this.UIMode = UIModes.Loading;
        this.m_CurrentListId = null;
        document.querySelector('h1').innerText = T_ALL_LISTS;
        document
            .querySelector('div.add > input')
            .setAttribute('placeholder', T_WRITE_LIST_TEXT);
        let postData = new FormData();
        postData.append('what', 'lists');
        let requestOptions = {
            method: 'POST',
            mode: 'same-origin',
            body: postData,
        };
        fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
            .then((response) => __awaiter(this, void 0, void 0, function* () {
            const ret = yield response.text();
            if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
                this.showModal(T_AJAX_ERROR_TITLE, ret);
                return;
            }
            this.m_CurrentDigest = ret.substring(2, 12);
            const data = JSON.parse(ret.substring(12));
            const items = document.querySelector('#lists');
            const newitems = document.createDocumentFragment();
            for (var id in data)
                if (data.hasOwnProperty(id))
                    newitems.append(this.makeList(id, data[id]));
            while (items.lastChild)
                items.removeChild(items.lastChild);
            items.appendChild(newitems);
            if (!sneaky)
                this.UIMode = UIModes.Lists;
            this.createEventSource();
        }))
            .catch((error) => {
            this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
            return;
        });
    }
    loadItems(sneaky, listId) {
        this.destroyEventSource();
        this.m_UpdatePending = false;
        this.m_IsEditing = false;
        if (!sneaky)
            this.UIMode = UIModes.Loading;
        this.m_CurrentListId = listId;
        document
            .querySelector('div.add > input')
            .setAttribute('placeholder', T_WRITE_ITEM_TEXT);
        let postData = new FormData();
        postData.append('what', 'getitems');
        postData.append('listid', this.m_CurrentListId);
        let requestOptions = {
            method: 'POST',
            mode: 'same-origin',
            body: postData,
        };
        fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
            .then((response) => __awaiter(this, void 0, void 0, function* () {
            const ret = yield response.text();
            if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
                this.showModal(T_AJAX_ERROR_TITLE, ret);
                return;
            }
            this.m_CurrentDigest = ret.substring(2, 12);
            const data = JSON.parse(ret.substring(12));
            const items = document.querySelector('#items');
            const newitems = document.createDocumentFragment();
            for (var id in data)
                if (data.hasOwnProperty(id))
                    newitems.appendChild(this.makeItem(id, data[id]['item'], data[id]['checked']));
            while (items.lastChild)
                items.removeChild(items.lastChild);
            items.appendChild(newitems);
            if (!sneaky)
                this.UIMode = UIModes.Items;
            this.createEventSource();
        }))
            .catch((error) => {
            this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
            return;
        });
    }
    handleAddKeyUp(evt) {
        if (evt === null)
            return;
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
            let postData = new FormData();
            postData.append('what', 'newlist');
            postData.append('name', val);
            let requestOptions = {
                method: 'POST',
                mode: 'same-origin',
                body: postData,
            };
            fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
                .then((response) => __awaiter(this, void 0, void 0, function* () {
                const ret = yield response.text();
                if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
                    this.showModal(T_AJAX_ERROR_TITLE, ret);
                    return;
                }
                this.m_CurrentDigest = ret.substring(2, 12);
                var id = ret.substring(12);
                const items = document.querySelector('#lists');
                items.appendChild(this.makeList(id, val));
            }))
                .catch((error) => {
                this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
                return;
            });
            return;
        }
        if ((this.UIMode & UIModes.Items) === UIModes.Items) {
            let postData = new FormData();
            postData.append('what', 'additem');
            postData.append('listid', this.m_CurrentListId);
            postData.append('item', val);
            let requestOptions = {
                method: 'POST',
                mode: 'same-origin',
                body: postData,
            };
            fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
                .then((response) => __awaiter(this, void 0, void 0, function* () {
                const ret = yield response.text();
                if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
                    this.showModal(T_AJAX_ERROR_TITLE, ret);
                    return;
                }
                this.m_CurrentDigest = ret.substring(2, 12);
                var id = ret.substring(12);
                const items = document.querySelector('#items');
                items.appendChild(this.makeItem(id, val, false));
            }))
                .catch((error) => {
                this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
                return;
            });
            return;
        }
        throw 'Invalid mode.';
    }
    handleBeforeUnload() {
        this.destroyEventSource();
    }
    handleVisibilityChange() {
        if (document.visibilityState != 'visible') {
            this.destroyEventSource();
            return;
        }
        this.createEventSource();
    }
    createEventSource() {
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
        this.m_EventSource = new EventSource(kaimonokun.EVENTSOURCE_LOCATION +
            '?watch=' +
            watch +
            '&auth=' +
            this.m_AuthLine);
        this.m_EventSource.addEventListener('message', (ev) => this.eventSourceOnMessageImpl(ev));
        this.m_EventSource.addEventListener('error', () => this.eventSourceOnErrorImpl());
    }
    destroyEventSource() {
        if (this.m_EventSource == null)
            return;
        this.m_EventSource.onerror = null;
        this.m_EventSource.close();
        this.m_EventSource = null;
    }
    eventSourceOnErrorImpl() {
        if (this.m_EventSource === null)
            return;
        if (this.m_EventSource.readyState == EventSource.CONNECTING)
            return;
        if (this.m_EventSource.readyState == EventSource.CLOSED) {
            this.showModal(T_EVENTSOURCE_ERROR_TITLE, T_EVENTSOURCE_ERROR_GENERIC_TEXT);
            return;
        }
    }
    eventSourceOnMessageImpl(e) {
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
            this.loadItems(true, this.m_CurrentListId);
            return;
        }
        throw 'Invalid mode.';
    }
    makeList(listId, listName) {
        const tpl = document.getElementById('tpl-list');
        const content = tpl.content.cloneNode(true)
            .firstElementChild;
        content.dataset['listid'] = listId;
        let el;
        el = content.querySelector('span');
        el.innerText = listName;
        el.addEventListener('click', (ev) => this.handleClick(ev));
        el = content.querySelector('input');
        el.style.display = 'none';
        el.addEventListener('keyup', (ev) => this.handleEditKeyUp(ev));
        el = content.querySelector('.save');
        el.parentElement.style.display = 'none';
        el.addEventListener('click', (ev) => this.handleSave(ev));
        el = content.querySelector('.edit');
        el.addEventListener('click', (ev) => this.handleEdit(ev));
        el = content.querySelector('.erase');
        el.addEventListener('click', (ev) => this.handleErase(ev));
        return content;
    }
    makeItem(itemId, text, checked) {
        const tpl = document.getElementById('tpl-item');
        const content = tpl.content.cloneNode(true)
            .firstElementChild;
        content.dataset['itemid'] = itemId;
        content.dataset['checked'] = checked ? '1' : '0';
        content.addEventListener('dragstart', (ev) => this.handleDrag(ev));
        content.addEventListener('dragend', (ev) => this.handleDragEnd());
        content.addEventListener('dragenter', (ev) => this.handleDragEnter(ev));
        content.addEventListener('dragover', (ev) => this.handleDragOver(ev));
        let el;
        el = content.querySelector('span');
        if (checked)
            el.classList.add('checked');
        el.innerText = text;
        el.addEventListener('click', (ev) => this.handleClick(ev));
        el = content.querySelector('input');
        el.style.display = 'none';
        el.addEventListener('keyup', (ev) => this.handleEditKeyUp(ev));
        el = content.querySelector('.save');
        el.parentElement.style.display = 'none';
        el.addEventListener('click', (ev) => this.handleSave(ev));
        el = content.querySelector('.edit');
        el.addEventListener('click', (ev) => this.handleEdit(ev));
        el = content.querySelector('.erase');
        el.addEventListener('click', (ev) => this.handleErase(ev));
        el = content.querySelector('.sort');
        el.addEventListener('touchstart', (ev) => this.handleTouch(ev));
        el.addEventListener('touchend', (ev) => this.handleTouchEnd());
        el.addEventListener('touchmove', (ev) => this.handleTouchMove(ev));
        return content;
    }
    handleClick(evt) {
        if (evt === null)
            return;
        if (!(evt.target instanceof HTMLElement))
            return;
        evt.preventDefault();
        let el = evt.target;
        while (el && !el.classList.contains('item'))
            el = el.parentElement;
        if (!el)
            return;
        if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
            const list_id = el.dataset['listid'];
            const list_name = el.querySelector('span').innerText.trim();
            document.querySelector('h1').innerText = list_name;
            this.loadItems(false, list_id);
            return;
        }
        if ((this.UIMode & UIModes.Items) === UIModes.Items) {
            const item_id = el.dataset['itemid'];
            let is_checked = el.dataset['checked'] === '1';
            is_checked = !is_checked;
            {
                let span = el.querySelector('span');
                if (is_checked) {
                    el.dataset['checked'] = '1';
                    span.classList.add('checked');
                }
                else {
                    el.dataset['checked'] = '0';
                    span.classList.remove('checked');
                }
            }
            let postData = new FormData();
            postData.append('what', 'checkitem');
            postData.append('listid', this.m_CurrentListId);
            postData.append('id', item_id);
            postData.append('checked', is_checked ? 'T' : 'F');
            let requestOptions = {
                method: 'POST',
                mode: 'same-origin',
                body: postData,
            };
            fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
                .then((response) => __awaiter(this, void 0, void 0, function* () {
                const ret = yield response.text();
                if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
                    this.showModal(T_AJAX_ERROR_TITLE, ret);
                    return;
                }
                this.m_CurrentDigest = ret.substring(2, 12);
            }))
                .catch((error) => {
                this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
                return;
            });
            return;
        }
        throw 'Invalid mode.';
    }
    handleEdit(evt) {
        if (evt === null)
            return;
        if (!(evt.target instanceof HTMLElement))
            return;
        evt.preventDefault();
        let el = evt.target;
        while (el && !el.classList.contains('item'))
            el = el.parentElement;
        if (!el)
            return;
        this.m_IsEditing = true;
        el.draggable = false; // Required to change caret position in input field
        let input = el.querySelector('input');
        let span = el.querySelector('span');
        input.value = span.innerText.trim();
        span.style.display = 'none';
        input.style.display = 'block';
        let el2;
        el2 = el.querySelector('.save');
        el2.parentElement.style.display = 'block';
        el2 = el.querySelector('.edit');
        el2.parentElement.style.display = 'none';
        el2 = el.querySelector('.erase');
        el2.parentElement.style.display = 'none';
        if (window.matchMedia('(max-width:48em)').matches) {
            el2 = el.querySelector('.sortcontainer');
            el2.style.display = 'none';
        }
        input.focus();
    }
    handleSave(evt) {
        if (evt === null)
            return;
        if (!(evt.target instanceof HTMLElement))
            return;
        evt.preventDefault();
        let el = evt.target;
        while (el && !el.classList.contains('item'))
            el = el.parentElement;
        if (!el)
            return;
        el.draggable = true; // Was turned to false in handleEdit
        let input = el.querySelector('input');
        let span = el.querySelector('span');
        const oldtext = span.innerText.trim();
        const newtext = input.value.trim();
        // if (newtext.length == 0 || oldtext == newtext)
        //     goto done; // haha, you wish this language was sane :(
        if (newtext.length != 0 && oldtext != newtext) {
            if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
                const list_id = el.dataset['listid'];
                let postData = new FormData();
                postData.append('what', 'renlist');
                postData.append('id', list_id);
                postData.append('newname', newtext);
                let requestOptions = {
                    method: 'POST',
                    mode: 'same-origin',
                    body: postData,
                };
                fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
                    .then((response) => __awaiter(this, void 0, void 0, function* () {
                    const ret = yield response.text();
                    if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
                        this.showModal(T_AJAX_ERROR_TITLE, ret);
                        return;
                    }
                }))
                    .catch((error) => {
                    this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
                    return;
                });
            }
            else if ((this.UIMode & UIModes.Items) === UIModes.Items) {
                const item_id = el.dataset['itemid'];
                let postData = new FormData();
                postData.append('what', 'renitem');
                postData.append('listid', this.m_CurrentListId);
                postData.append('id', item_id);
                postData.append('newitem', newtext);
                let requestOptions = {
                    method: 'POST',
                    mode: 'same-origin',
                    body: postData,
                };
                fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
                    .then((response) => __awaiter(this, void 0, void 0, function* () {
                    const ret = yield response.text();
                    if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
                        this.showModal(T_AJAX_ERROR_TITLE, ret);
                        return;
                    }
                }))
                    .catch((error) => {
                    this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
                    return;
                });
            }
            else
                throw 'Invalid mode.';
        }
        // done:
        span.innerText = newtext;
        input.style.display = 'none';
        span.style.display = 'block';
        let el2;
        el2 = el.querySelector('.save');
        el2.parentElement.style.display = 'none';
        el2 = el.querySelector('.edit');
        el2.parentElement.style.display = 'block';
        el2 = el.querySelector('.erase');
        el2.parentElement.style.display = 'block';
        if (window.matchMedia('(max-width:48em)').matches) {
            el2 = el.querySelector('.sortcontainer');
            el2.style.display = 'block';
        }
        this.m_IsEditing = false;
        if (!this.m_UpdatePending)
            return;
        if ((this.UIMode & UIModes.Lists) === UIModes.Lists)
            this.loadLists(true);
        else if ((this.UIMode & UIModes.Items) === UIModes.Items)
            this.loadItems(true, this.m_CurrentListId);
        else
            throw 'Invalid mode.';
    }
    handleEditKeyUp(evt) {
        if (evt === null)
            return;
        if (!(evt.target instanceof HTMLElement))
            return;
        if (evt.keyCode !== 13)
            return;
        evt.preventDefault();
        this.handleSave(evt);
    }
    handleErase(evt) {
        if (evt === null)
            return;
        if (!(evt.target instanceof HTMLElement))
            return;
        evt.preventDefault();
        let el = evt.target;
        while (el && !el.classList.contains('item'))
            el = el.parentElement;
        if (!el)
            return;
        if ((this.UIMode & UIModes.Lists) === UIModes.Lists) {
            const list_id = el.dataset['listid'];
            let postData = new FormData();
            postData.append('what', 'dellist');
            postData.append('id', list_id);
            let requestOptions = {
                method: 'POST',
                mode: 'same-origin',
                body: postData,
            };
            fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
                .then((response) => __awaiter(this, void 0, void 0, function* () {
                const ret = yield response.text();
                if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
                    this.showModal(T_AJAX_ERROR_TITLE, ret);
                    return;
                }
                el.remove();
            }))
                .catch((error) => {
                this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
                return;
            });
        }
        else if ((this.UIMode & UIModes.Items) === UIModes.Items) {
            const item_id = el.dataset['itemid'];
            let postData = new FormData();
            postData.append('what', 'delitem');
            postData.append('listid', this.m_CurrentListId);
            postData.append('id', item_id);
            let requestOptions = {
                method: 'POST',
                mode: 'same-origin',
                body: postData,
            };
            fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
                .then((response) => __awaiter(this, void 0, void 0, function* () {
                const ret = yield response.text();
                if (!response.ok || ret.length < 2 || ret.substring(0, 2) != 'OK') {
                    this.showModal(T_AJAX_ERROR_TITLE, ret);
                    return;
                }
                el.remove();
            }))
                .catch((error) => {
                this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
                return;
            });
        }
        else
            throw 'Invalid mode.';
    }
    handleDrag(evt) {
        if (evt === null)
            return;
        evt.dataTransfer.effectAllowed = 'move';
        this.m_DragTarget = evt.target;
        this.m_DragTarget.classList.add('onDrag');
    }
    handleDragEnd() {
        if (this.m_DragTarget == null)
            return;
        this.m_DragTarget.classList.remove('onDrag');
        let new_order = '';
        document
            .querySelectorAll('div#items>div.item')
            .forEach(function (el) {
            new_order += el.dataset['itemid'] + '/';
        });
        new_order = new_order.slice(0, -1);
        let postData = new FormData();
        postData.append('what', 'changesort');
        postData.append('listid', this.m_CurrentListId);
        postData.append('neworder', new_order);
        let requestOptions = {
            method: 'POST',
            mode: 'same-origin',
            body: postData,
        };
        fetch(kaimonokun.BACKEND_LOCATION, requestOptions)
            .then((response) => __awaiter(this, void 0, void 0, function* () {
            const ret = yield response.text();
            if (!response.ok || ret.length < 12 || ret.substring(0, 2) != 'OK') {
                this.showModal(T_AJAX_ERROR_TITLE, ret);
                return;
            }
            this.m_CurrentDigest = ret.substring(2, 12);
        }))
            .catch((error) => {
            this.showModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + error);
            return;
        });
        this.m_DragTarget = null;
    }
    handleDragOver(evt) {
        if (evt === null)
            return;
        evt.dataTransfer.dropEffect = 'move';
        evt.preventDefault();
    }
    handleDragEnter(evt) {
        if (evt === null)
            return;
        if (this.m_DragTarget == null)
            return;
        const target_el = evt.target;
        if (target_el.nodeType != Node.ELEMENT_NODE)
            return;
        // Can only enter item contaienrs, not their children
        if (!target_el.classList.contains('item'))
            return;
        evt.dataTransfer.dropEffect = 'move';
        target_el.parentNode.insertBefore(this.m_DragTarget, target_el);
        evt.preventDefault();
    }
    handleTouch(evt) {
        if (evt === null)
            return;
        this.m_TouchMoved = false;
        this.m_TouchTime = Date.now();
        let el = evt.target;
        // Finger was not on the item container but on one of its children, so walk up the DOM tree
        while (el && !el.classList.contains('item'))
            el = el.parentNode;
        if (!el)
            return; // No item container, WTF?
        // Found the item container!
        this.m_DragTarget = el;
        // Define valid destinations for dragging over
        let ttcs = [];
        document
            .querySelectorAll('div#items>div.item')
            .forEach(function (el) {
            const hel = el;
            const o = {
                target: hel,
                startX: hel.offsetLeft,
                endX: hel.offsetLeft + hel.offsetWidth,
                startY: hel.offsetTop,
                endY: hel.offsetTop + hel.offsetHeight,
            };
            ttcs.push(o);
        });
        this.m_TouchTargetCandidates = ttcs;
    }
    handleTouchEnd() {
        if (this.m_DragTarget === null)
            return;
        if (!this.m_TouchMoved ||
            Date.now() - this.m_TouchTime < kaimonokun.TOUCH_MIN_TIME_MS)
            return;
        this.m_DragTarget.classList.remove('onDrag');
        this.handleDragEnd();
    }
    handleTouchMove(evt) {
        if (evt === null)
            return;
        if (this.m_DragTarget === null)
            return;
        if (Date.now() - this.m_TouchTime < kaimonokun.TOUCH_MIN_TIME_MS)
            return;
        if (!this.m_TouchMoved) {
            // First movement of finger
            this.m_DragTarget.classList.add('onDrag');
            this.m_TouchMoved = true;
        }
        if (evt.changedTouches.length == 0)
            return;
        const client_x = evt.changedTouches[0].pageX;
        const client_y = evt.changedTouches[0].pageY;
        const tt = this.m_DragTarget;
        this.m_TouchTargetCandidates.some(function (item) {
            if (client_x < item.startX ||
                client_x > item.endX ||
                client_y < item.startY ||
                client_y > item.endY)
                return false;
            item.target.before(tt, item.target);
            return true;
        });
    }
    get UIMode() {
        return this.m_UIMode;
    }
    set UIMode(mode) {
        let candidates = {
            'div#content': mode !== UIModes.None,
            'div#loading': (mode & UIModes.Loading) === UIModes.Loading,
            'div#lists': (mode & UIModes.Lists) === UIModes.Lists,
            'div#items': (mode & UIModes.Items) === UIModes.Items,
            'div.add': (mode & UIModes.AllowAdd) === UIModes.AllowAdd,
        };
        for (let id in candidates) {
            let el = document.querySelector(id);
            let visible = candidates[id];
            el.style.display = visible ? 'block' : 'none';
        }
        const isItems = (mode & UIModes.Items) == UIModes.Items;
        document.querySelector('div.head a.backbutton').parentElement.style.display = isItems ? 'block' : 'none';
        document.querySelector('div.head a.sortbutton').parentElement.style.display = isItems ? 'block' : 'none';
        this.m_UIMode = mode;
    }
    showModal(title, text) {
        this.m_PreModalScrollPos = [window.scrollX, window.scrollY];
        window.scrollTo(0, 0);
        document.querySelector('#modaltitle').innerText = title;
        document.querySelector('#modalcontent').innerText = text;
        document.querySelector('#content').classList.add('blur');
        document.body.classList.add('modal');
        document.querySelector('#modal').style.display = 'block';
        document.querySelector('#modalbutton').focus();
    }
    closeModal() {
        document.querySelector('#modal').style.display = 'none';
        document.querySelector('#content').classList.remove('blur');
        document.body.classList.remove('modal');
        if (this.m_PreModalScrollPos != null)
            window.scrollTo(this.m_PreModalScrollPos[0], this.m_PreModalScrollPos[1]);
    }
}
kaimonokun.TOUCH_MIN_TIME_MS = 150;
kaimonokun.DIGEST_LIST_NOT_EXIST = '0000000000';
kaimonokun.BACKEND_LOCATION = 'backend.php';
kaimonokun.EVENTSOURCE_LOCATION = 'monitor.php';
//# sourceMappingURL=script.js.map