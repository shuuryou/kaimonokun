const TOUCH_MIN_TIME_MS				= 150;
const MODE_LISTS					= 'LISTS';
const MODE_ITEMS					= 'ITEMS';
const DIGEST_LIST_NOT_EXIST			= '0000000000';
const BACKEND_LOCATION				= 'backend.php';
const EVENTSOURCE_LOCATION			= 'monitor.php';

var m_TouchMoved, m_Target, m_TouchTargetCandidates
var m_TouchTS;
var m_ItemTemplate, m_ListTemplate;
var m_Mode, m_CurrentListId, m_CurrentDigest;
var m_EventSource;
var m_IsEditing, m_UpdatePending;
var m_OldScroll;

$(document).ready(function()
{
	$('div#content').hide();

	m_ItemTemplate = $('script[data-template="item"]').text().trim();
	m_ListTemplate = $('script[data-template="list"]').text().trim();

	$('div.head a.addtogglebutton').on('click', ToggleAdd);
	$('div.head a.sortbutton').on('click', SortItems);
	$('div.head a.backbutton').on('click', LoadLists);
	$('div.add > input').on('keyup', handleAddKeyUp);
	$('div.add').hide();

	m_TouchMoved = null;
	m_Target = null;
	m_TouchTargetCandidates = null;
	m_TouchTS = 0;
	m_PreventScroll = false;
	m_Mode = null;
	m_CurrentListId = null;
	m_CurrentDigest = null;
	m_EventSource = null;
	m_IsEditing = false;
	m_UpdatePending = false;
	m_OldScroll = null;

	$(window).on('beforeunload', function()
	{
	  DestroyEventSource();
	});
	
	$(document).on('visibilitychange', function()
	{
		if (document.visibilityState != 'visible')
		{
			DestroyEventSource();
			return;
		}

		CreateEventSource();
	});

	LoadLists();
});

function CreateEventSource()
{
	if (m_EventSource != null)
		return;

	if (document.visibilityState != 'visible')
		return;

	var watch;

	if (m_Mode == MODE_LISTS)
		watch = 'lists';
	else if (m_Mode == MODE_ITEMS)
		watch = m_CurrentListId;
	else
		throw 'Invalid mode.';

	m_EventSource = new EventSource(EVENTSOURCE_LOCATION + '?watch=' + watch + '&auth=' + AUTHLINE);
	m_EventSource.onmessage = EventSourceOnMessageImpl;
	m_EventSource.onerror = EventSourceOnErrorImpl;
}

function DestroyEventSource()
{
	if (m_EventSource == null)
		return;

	m_EventSource.onerror = null;
	m_EventSource.close();
	m_EventSource = null;
}

function EventSourceOnErrorImpl(e)
{
	if (e.target.readyState == EventSource.CONNECTING)
	{
		return;
	}

	if (e.target.readyState == EventSource.CLOSED)
	{
		ShowModal(T_EVENTSOURCE_ERROR_TITLE, T_EVENTSOURCE_ERROR_GENERIC_TEXT);
		return;
	}
}

function EventSourceOnMessageImpl(e)
{
	var digest = e.data.trim();

	if (m_CurrentDigest == digest)
	{
		console.log('EventSource: Remote digest %s is the same as ours, so ignore.', digest);
		return;
	}

	console.log('EventSource: Remote digest is %s and ours is %s.', digest, m_CurrentDigest);
	m_CurrentDigest = digest;

	if (m_IsEditing)
	{
		console.log('Defer processing while some editing in progress.');
		m_UpdatePending = true;
	}

	if (m_Mode == MODE_LISTS)
	{
		SneakyLoadLists();
	}
	else if (m_Mode == MODE_ITEMS)
	{
		if (m_CurrentDigest == DIGEST_LIST_NOT_EXIST)
		{
			LoadLists();
			ShowModal(T_LIST_WAS_DELETED_TITLE, T_LIST_WAS_DELETED);
			return;
		}

		SneakyLoadItems();
	}
	else throw 'Invalid mode.';
}

function LoadLists()
{
	DestroyEventSource();

	m_UpdatePending = false;
	m_IsEditing = false;

	m_Mode = MODE_LISTS;
	m_CurrentListId = null;

	$('h1').text(T_ALL_LISTS);
	$('div.add > input').attr("placeholder", T_WRITE_LIST_TEXT);

	$('div.add').hide();
	$('div.head a.backbutton').parent().hide();
	$('div.head a.sortbutton').parent().hide();
	$('div#content').hide();
	$('div#loading').show();
	$('div#lists').hide();
	$('div#items').hide();

	$.post(BACKEND_LOCATION,
		{
			'what': 'lists'
		})
		.done(function(data)
		{
			if (data.length < 12 || data.substring(0, 2) != 'OK')
			{
				ShowModal(T_AJAX_ERROR_TITLE, data);
				return;
			}

			m_CurrentDigest = data.substring(2, 12);

			data = JSON.parse(data.substring(12));

			$('#lists').empty();

			for (var id in data)
				if (data.hasOwnProperty(id))
					$('#lists').append(makeList(id, data[id]));

			CreateEventSource();

			$('div#loading').hide();
			$('div#lists').show();
			$('div#content').show();
		})
		.fail(function(xhr, textStatus, errorThrown)
		{
			ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
		});
}

function LoadItems(listid, listname)
{
	DestroyEventSource();

	m_UpdatePending = false;
	m_IsEditing = false;

	m_Mode = MODE_ITEMS;
	m_CurrentListId = listid;

	$('h1').text(listname);
	$('div.add > input').attr("placeholder", T_WRITE_ITEM_TEXT);

	$('div.add').hide();
	$('div.head a.backbutton').parent().show();
	$('div.head a.sortbutton').parent().show();
	$('div#content').hide();
	$('div#loading').show();
	$('div#lists').hide();
	$('div#items').hide();

	$.post(BACKEND_LOCATION,
		{
			'what': 'getitems',
			'id': listid
		})
		.done(function(data)
		{
			if (data.length < 12 || data.substring(0, 2) != 'OK')
			{
				ShowModal(T_AJAX_ERROR_TITLE, data);
				return;
			}

			m_CurrentDigest = data.substring(2, 12);

			data = JSON.parse(data.substring(12));

			$('#items').empty();

			for (var id in data)
				if (data.hasOwnProperty(id))
					$('#items').append(makeItem(id, data[id].item, data[id].checked));

			CreateEventSource();

			$('div#loading').hide();
			$('div#items').show();
			$('div#content').show();
		})
		.fail(function(xhr, textStatus, errorThrown)
		{
			ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
		});
}

function SneakyLoadLists()
{
	if (m_IsEditing)
		return;

	m_UpdatePending = false;

	$.post(BACKEND_LOCATION,
		{
			'what': 'lists'
		})
		.done(function(data)
		{
			if (data.length < 12 || data.substring(0, 2) != 'OK')
			{
				ShowModal(T_AJAX_ERROR_TITLE, data);
				return;
			}

			data = JSON.parse(data.substring(12));

			var f = $(document.createDocumentFragment());

			for (var id in data)
				if (data.hasOwnProperty(id))
					f.append(makeList(id, data[id]));

			$('#lists').empty().append(f);
		})
		.fail(function(xhr, textStatus, errorThrown)
		{
			ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
		});
}

function SneakyLoadItems()
{
	if (m_IsEditing)
		return;

	m_UpdatePending = false;

	$.post(BACKEND_LOCATION,
		{
			'what': 'getitems',
			'id': m_CurrentListId
		})
		.done(function(data)
		{
			if (data.length < 12 || data.substring(0, 2) != 'OK')
			{
				ShowModal(T_AJAX_ERROR_TITLE, data);
				return;
			}

			data = JSON.parse(data.substring(12));

			var f = $(document.createDocumentFragment());

			for (var id in data)
				if (data.hasOwnProperty(id))
					f.append(makeItem(id, data[id].item, data[id].checked));

			$('#items').empty().append(f);

		})
		.fail(function(xhr, textStatus, errorThrown)
		{
			ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
		});
}

function SortItems()
{
	$('div#content').hide();
	$('div#loading').show();
	$('div#lists').hide();
	$('div#items').hide();

	DestroyEventSource();

	$.post(BACKEND_LOCATION,
		{
			'what': 'sortitems',
			'listid': m_CurrentListId
		})
		.done(function(data)
		{
			if (data.length < 2 || data.substring(0, 2) != 'OK')
			{
				ShowModal(T_AJAX_ERROR_TITLE, data);
				return;
			}

			LoadItems(m_CurrentListId, $('h1').text());
		})
		.fail(function(xhr, textStatus, errorThrown)
		{
			ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
		});
}

function ToggleAdd()
{
	$('div.add').toggle();

	if ($('div.add').is(":visible"))
		$('div.add > input').focus();
}

function handleAddKeyUp(event)
{
	if (event.keyCode !== 13)
		return;

	event.preventDefault();
	var input = $(event.target);
	var val = input.val().trim();
	input.val('');

	if (val == '')
	{
		ToggleAdd();
		return;
	}

	if (m_Mode == MODE_LISTS)
	{
		$.post(BACKEND_LOCATION,
			{
				'what': 'newlist',
				'name': val
			})
			.done(function(data)
			{
				if (data.length < 12 || data.substring(0, 2) != 'OK')
				{
					ShowModal(T_AJAX_ERROR_TITLE, data);
					return;
				}

				m_CurrentDigest = data.substring(2, 12);

				var id = data.substring(12);
				$('#lists').append(makeList(id, val));
			})
			.fail(function(xhr, textStatus, errorThrown)
			{
				ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
			});

		return;
	}
	else if (m_Mode == MODE_ITEMS)
	{
		$.post(BACKEND_LOCATION,
			{
				'what': 'additem',
				'listid': m_CurrentListId,
				'item': val
			})
			.done(function(data)
			{
				if (data.length < 12 || data.substring(0, 2) != 'OK')
				{
					ShowModal(T_AJAX_ERROR_TITLE, data);
					return;
				}

				m_CurrentDigest = data.substring(2, 12);

				var id = data.substring(12);
				$('#items').append(makeItem(id, val, false));
			})
			.fail(function(xhr, textStatus, errorThrown)
			{
				ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
			});

		return;
	}
	else throw 'Invalid mode.';
}

function makeList(listid, listname)
{
	var el = $($.parseHTML(m_ListTemplate));

	el.data('listid', listid);

	var span = el.find('span');

	span.text(listname);

	span.on('click', handleClick);
	var input = el.find('input');

	input.hide();
	input.on('keyup', handleEditKeyUp);

	var save = el.find('.save');
	save.parent().hide();
	save.on('click', handleSave);

	el.find('.edit').on('click', handleEdit);
	el.find('.erase').on('click', handleErase);

	return el;
}

function makeItem(itemid, text, checked)
{
	checked = checked === true ? '1' : '0';
	var el = $($.parseHTML(m_ItemTemplate));

	el.data('itemid', itemid);
	el.data('checked', checked);
	el.on('dragstart', handleDrag);
	el.on('dragend', handleDragEnd);
	el.on('dragenter', handleDragEnter);
	el.on('dragover', handleDragOver);
	
	var span = el.find('span');

	if (checked == '1')
		span.addClass('checked');

	span.text(text);

	span.on('click', handleClick);

	var input = el.find('input');

	input.hide();
	input.on('keyup', handleEditKeyUp);

	var save = el.find('.save');
	save.parent().hide();
	save.on('click', handleSave);

	el.find('.edit').on('click', handleEdit);
	el.find('.erase').on('click', handleErase);

	el.find('.sort').on('touchstart', handleTouch);
	el.find('.sort').on('touchend', handleTouchEnd);
	el.find('.sort').on('touchmove', handleTouchMove);
	
	return el;
}

function handleEdit(event)
{
	event.preventDefault();

	var el = $(event.target);

	while (el && !el.hasClass('item'))
		el = el.parent();

	if (!el)
		return;

	m_IsEditing = true;
	
	el.attr('draggable', 'false'); // Required to change caret position in input field

	var input = el.find('input');
	var span = el.find('span');

	input.val(span.text().trim());

	span.hide();
	input.show();

	el.find('.save').parent().show();
	el.find('.edit').parent().hide();
	el.find('.erase').parent().hide();

	if (window.matchMedia('(max-width:48em)').matches)
		el.find('.sortcontainer').hide();

	input.focus();
}

function handleSave(event)
{
	event.preventDefault();

	var el = $(event.target);

	while (el && !el.hasClass('item'))
		el = el.parent();

	if (!el)
		return;
		
	el.attr('draggable', 'true'); // Was turned to false in handleEdit

	var input = el.find('input');
	var span = el.find('span');

	var oldtext = span.text().trim();
	var newtext = input.val().trim();

	if (newtext.length == 0)
		newtext = oldtext;

	if (oldtext != newtext)
	{
		if (m_Mode == MODE_LISTS)
		{
			var listid = el.data('listid');

			$.post(BACKEND_LOCATION,
				{
					'what': 'renlist',
					'id': listid,
					'newname': newtext
				})
				.done(function(data)
				{
					if (data.length < 2 || data.substring(0, 2) != 'OK')
						ShowModal(T_AJAX_ERROR_TITLE, data);

					span.text(newtext);
				})
				.fail(function(xhr, textStatus, errorThrown)
				{
					ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
				});
		}
		else if (m_Mode == MODE_ITEMS)
		{
			var itemid = el.data('itemid');

			$.post(BACKEND_LOCATION,
				{
					'what': 'renitem',
					'listid': m_CurrentListId,
					'id': itemid,
					'newitem': newtext
				})
				.done(function(data)
				{
					if (data.length < 12 || data.substring(0, 2) != 'OK')
						ShowModal(T_AJAX_ERROR_TITLE, data);

					m_CurrentDigest = data.substring(2, 12);

					span.text(newtext);
				})
				.fail(function(xhr, textStatus, errorThrown)
				{
					ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
				});
		}
		else throw 'Invalid mode.';
	}

	input.hide();
	span.show();

	el.find('.save').parent().hide();
	el.find('.edit').parent().show();
	el.find('.erase').parent().show();

	if (window.matchMedia('(max-width:48em)').matches)
		el.find('.sortcontainer').show();

	m_IsEditing = false;

	if (m_UpdatePending)
	{
		if (m_Mode == MODE_LISTS)
			SneakyLoadLists();
		else if (m_Mode == MODE_ITEMS)
			SneakyLoadItems();
		else throw 'Invalid mode.';
	}
}

function handleEditKeyUp(event)
{
	if (event.keyCode !== 13)
		return;

	event.preventDefault();
	handleSave(event);
}

function handleErase(event)
{
	event.preventDefault();

	var el = $(event.target);

	while (el && !el.hasClass('item'))
		el = el.parent();

	if (!el)
		return;

	if (m_Mode == MODE_LISTS)
	{
		var listid = el.data('listid');

		$.post(BACKEND_LOCATION,
			{
				'what': 'dellist',
				'id': listid
			})
			.done(function(data)
			{
				if (data.length < 2 || data.substring(0, 2) != 'OK')
					ShowModal(T_AJAX_ERROR_TITLE, data);

				el.remove();
			})
			.fail(function(xhr, textStatus, errorThrown)
			{
				ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
			});
	}
	else if (m_Mode == MODE_ITEMS)
	{
		var itemid = el.data('itemid');

		$.post(BACKEND_LOCATION,
			{
				'what': 'delitem',
				'listid': m_CurrentListId,
				'id': itemid
			})
			.done(function(data)
			{
				if (data.length < 12 || data.substring(0, 2) != 'OK')
					ShowModal(T_AJAX_ERROR_TITLE, data);

				m_CurrentDigest = data.substring(2, 12);

				el.remove();
			})
			.fail(function(xhr, textStatus, errorThrown)
			{
				ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
			});
		return;
	}
	else throw 'Invalid mode.';
}

function handleClick(event)
{
	var el = $(event.target);

	while (el && !el.hasClass('item'))
		el = el.parent();

	if (!el)
		return;

	if (m_Mode == MODE_LISTS)
	{
		var listid = el.data('listid');
		var listname = el.find('span').text().trim();

		LoadItems(listid, listname);

		return;
	}
	else if (m_Mode == MODE_ITEMS)
	{
		var itemid = el.data('itemid');

		var checked = el.data('checked') == '1';

		checked = !checked;

		if (!checked)
		{
			el.data('checked', '0');
			el.find('span').removeClass('checked');
		}
		else
		{
			el.data('checked', '1');
			el.find('span').addClass('checked');
		}

		$.post(BACKEND_LOCATION,
			{
				'what': 'checkitem',
				'listid': m_CurrentListId,
				'id': itemid,
				'checked': checked ? 'T' : 'F'
			})
			.done(function(data)
			{
				if (data.length < 12 || data.substring(0, 2) != 'OK')
					ShowModal(T_AJAX_ERROR_TITLE, data);

				m_CurrentDigest = data.substring(2, 12);
			})
			.fail(function(xhr, textStatus, errorThrown)
			{
				ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
			});

		return;
	}
	else throw 'Invalid mode.';
}

function handleDrag(event)
{
	event.originalEvent.dataTransfer.effectAllowed = 'move';
	m_Target = $(event.target);
	m_Target.addClass('onDrag');
}

function handleDragEnd(event)
{
	m_Target.removeClass('onDrag');

	var neworder = '';

	$('div#items>div.item').each(function()
	{
		neworder += $(this).data('itemid') + '/';
	});

	neworder = neworder.substring(0, neworder.length - 1);

	$.post(BACKEND_LOCATION,
		{
			'what': 'changesort',
			'listid': m_CurrentListId,
			'neworder': neworder
		})
		.done(function(data)
		{
			if (data.length < 12 || data.substring(0, 2) != 'OK')
				ShowModal(T_AJAX_ERROR_TITLE, data);

			m_CurrentDigest = data.substring(2, 12);
		})
		.fail(function(xhr, textStatus, errorThrown)
		{
			ShowModal(T_AJAX_ERROR_TITLE, T_AJAX_ERROR_GENERIC_TEXT + xhr.responseText);
		});
}

function handleDragOver(event)
{
	// Can only drag over item containers, not their children
	if (event.target.id != 'list')
		return;

	event.originalEvent.dataTransfer.dropEffect = 'move';
	event.preventDefault();
}

function handleDragEnter(event)
{
	// Can only enter item contaienrs, not their children
	if (!$(event.target).hasClass('item'))
		return;

	event.originalEvent.dataTransfer.dropEffect = 'move';
	$(event.target).before(m_Target);
	event.preventDefault();
}

function handleTouch(event)
{
	m_TouchMoved = false;
	m_TouchTS = Date.now();

	var el = $(event.target);

	// Finger was not on the item container but on one of its children, so walk up the DOM tree
	while (el && !el.hasClass('item'))
		el = el.parent();

	if (!el)
		return; // No item container, WTF?

	// Found the item container!
	m_Target = el;

	// Define valid destinations for dragging over
	m_TouchTargetCandidates = [];

	$('div#items>div.item').each(function()
	{
		var o = {};
		o.target = this;
		o.startX = this.offsetLeft;
		o.endX = this.offsetLeft + this.offsetWidth;
		o.startY = this.offsetTop;
		o.endY = this.offsetTop + this.offsetHeight;
		m_TouchTargetCandidates.push(o);
	});
}

function handleTouchEnd(event)
{
	if (!m_TouchMoved || (Date.now() - m_TouchTS) < TOUCH_MIN_TIME_MS)
		return;
	
	m_Target.removeClass('onDrag');
	handleDragEnd(event);
}

function handleTouchMove(event)
{
	if ((Date.now() - m_TouchTS) < TOUCH_MIN_TIME_MS)
		return;
		
	if (!m_TouchMoved)
	{
		// First movement of finger
		m_Target.addClass('onDrag');
		m_TouchMoved = true;
	}

	var clientx = event.changedTouches[0].pageX;
	var clienty = event.changedTouches[0].pageY;

	m_TouchTargetCandidates.some(function(item)
	{
		if (clientx < item.startX || clientx > item.endX || clienty < item.startY || clienty > item.endY)
			return false;

		$(item.target).before(m_Target);
		return true;
	});
}

function ShowModal(title, text)
{
	m_OldScroll = [ window.scrollX, window.scrollY ];
	window.scrollTo(0, 0);
	
	$('#modaltitle').text(title);
	$('#modalcontent').text(text);
	$('#content').addClass('blur');
	$('body').addClass('modal');
	$('#modal').show();
	$('#modalbutton').focus();
}

function CloseModal()
{
	$('#modal').hide();
	$('#content').removeClass('blur');
	$('body').removeClass('modal');

	window.scrollTo(m_OldScroll[0], m_OldScroll[1]);
	m_OldScroll = null;	
}