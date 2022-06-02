<?php
define('IN_LIST', TRUE);
require_once('init.php');

if (empty($_POST['what']))
{
		http_response_code(500);
		echo __('T_ERR_MISSING_ACTION', array(), FALSE);
	return;
}

$WHAT = strtoupper($_POST['what']);
switch ($WHAT)
{
	case 'LISTS':		LISTS();		break;
	case 'NEWLIST':		NEWLIST();		break;
	case 'RENLIST':		RENLIST();		break;
	case 'DELLIST':		DELLIST();		break;
	
	case 'GETITEMS':	GETITEMS();		break;
	case 'ADDITEM':		ADDITEM();		break;
	case 'RENITEM':		RENITEM();		break;
	case 'CHECKITEM':	CHECKITEM();	break;
	case 'DELITEM':		DELITEM();		break;
	case 'SORTITEMS':	SORTITEMS();	break;
	case 'CHANGESORT':	CHANGESORT();	break;
}

function LISTS()
{
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));
	else
		$lists = array();
	
	echo 'OK';
	echo digest($lists_file);
	echo json_encode($lists);
	exit();
}

function NEWLIST()
{
	if (empty($_POST['name']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_NAME', array(), FALSE);
		return;
	}
	
	$list_name = trim($_POST['name']);
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));
	else
		$lists = array();
		
	foreach ($lists as $v)
	{
		if (mb_strcasecmp($list_name, $v) == 0)
		{
			http_response_code(500);
			echo __('T_ERR_LIST_ALREADY_EXISTS', array(), FALSE);
			return;
		}
	}

	$id = uniqid('', true);
	$lists[$id] = $list_name;
	
	uasort($lists, 'mb_strcasecmp');
	
	file_put_contents($lists_file, serialize($lists), LOCK_EX);
	
	$list_file = file_build_path(LISTS_DIR, $id);
	file_put_contents($list_file, serialize(array()), LOCK_EX);

	echo 'OK';
	echo digest($lists_file);
	echo $id;
	exit();
}

function RENLIST()
{
	if (empty($_POST['id']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}
	
	if (empty($_POST['newname']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_NEW_LIST_NAME', array(), FALSE);
		return;
	}
	
	$id = $_POST['id'];
	$new_name = trim($_POST['newname']);
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));
	else
		$lists = array();

	$found = false;
		
	foreach ($lists as $k => $v)
	{
		if ($k == $id)
		{		
			$found = true;
			$lists[$k] = $new_name;
			break;
		}
	}

	if (!$found)
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}

	uasort($lists, 'mb_strcasecmp');
	
	file_put_contents($lists_file, serialize($lists), LOCK_EX);

	echo 'OK';
	exit();
}

function DELLIST()
{
	if (empty($_POST['id']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}

	$id = $_POST['id'];
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));
	else
		$lists = array();

	if (array_key_exists($id, $lists))
	{
		$list_file = file_build_path(LISTS_DIR, $id);

		if (file_exists($list_file))
			unlink($list_file);

		unset($lists[$id]);
		
		file_put_contents($lists_file, serialize($lists), LOCK_EX);
	}

	echo 'OK';
	exit();
}

function GETITEMS()
{
	if (empty($_POST['listid']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}

	$id = $_POST['listid'];
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	$lists = array();

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));

	if (!array_key_exists($id, $lists))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	$list_file = file_build_path(LISTS_DIR, $id);

	$list = array();

	if (file_exists($list_file))
		$list = unserialize(file_get_contents($list_file));
	
	echo 'OK';
	echo digest($list_file);
	echo json_encode($list);
	exit();
}

function ADDITEM()
{
	if (empty($_POST['listid']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}
	
	if (empty($_POST['item']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_ITEM', array(), FALSE);
		return;
	}
	
	$list_id = $_POST['listid'];
	$item = trim($_POST['item']);
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	$lists = array();

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));

	if (!array_key_exists($list_id, $lists))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	unset($lists);
	unset($lists_file);
	
	$list_file = file_build_path(LISTS_DIR, $list_id);
	
	$list = array();

	if (file_exists($list_file))
		$list = unserialize(file_get_contents($list_file));
	
	$id = uniqid('', true);
	$list[$id] = array('item' => $item, 'checked' => FALSE);
	
	file_put_contents($list_file, serialize($list), LOCK_EX);
	
	echo 'OK';
	echo digest($list_file);
	echo $id;
	exit();
}

function RENITEM()
{
	if (empty($_POST['listid']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}
	
	if (empty($_POST['id']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_ITEM_ID', array(), FALSE);
		return;
	}
	
	if (empty($_POST['newitem']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_NEW_ITEM', array(), FALSE);
		return;
	}
	
	$list_id = $_POST['listid'];
	$item_id = $_POST['id'];
	$newitem = trim($_POST['newitem']);
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	$lists = array();

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));

	if (!array_key_exists($list_id, $lists))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	unset($lists);
	unset($lists_file);
	
	$list_file = file_build_path(LISTS_DIR, $list_id);
	
	$list = array();

	if (!file_exists($list_file))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	$list = unserialize(file_get_contents($list_file));

	foreach ($list as $k => $v)
	{
		if ($k == $item_id)
		{		
			$found = true;
			$list[$k]['item'] = $newitem;
			break;
		}
	}
	
	if (!$found)
		$list[$item_id] = array('item' => $newitem, 'checked' => FALSE);
	
	file_put_contents($list_file, serialize($list), LOCK_EX);

	echo 'OK';
	echo digest($list_file);
	exit();
}

function CHECKITEM()
{
	if (empty($_POST['listid']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}
	
	if (empty($_POST['id']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_ITEM_ID', array(), FALSE);
		return;
	}
	
	if (empty($_POST['checked']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_CHECKED', array(), FALSE);
		return;
	}
	
	$list_id = $_POST['listid'];
	$item_id = $_POST['id'];
	$checked = trim($_POST['checked']) === 'T';
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	$lists = array();

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));

	if (!array_key_exists($list_id, $lists))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	unset($lists);
	unset($lists_file);
	
	$list_file = file_build_path(LISTS_DIR, $list_id);
	
	$list = array();

	if (!file_exists($list_file))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	$list = unserialize(file_get_contents($list_file));

	foreach ($list as $k => $v)
	{
		if ($k == $item_id)
		{		
			$found = true;
			$list[$k]['checked'] = $checked;
			break;
		}
	}
	
	if (!$found)
		$list[$item_id] = array('item' => $newitem, 'checked' => FALSE);
	
	file_put_contents($list_file, serialize($list), LOCK_EX);
	
	echo 'OK';
	echo digest($list_file);	
	exit();
}

function DELITEM()
{
	if (empty($_POST['listid']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}
	
	if (empty($_POST['id']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_ITEM_ID', array(), FALSE);
		return;
	}
	
	$list_id = $_POST['listid'];
	$item_id = $_POST['id'];
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	$lists = array();

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));

	if (!array_key_exists($list_id, $lists))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	unset($lists);
	unset($lists_file);
	
	$list_file = file_build_path(LISTS_DIR, $list_id);
	
	$list = array();

	if (!file_exists($list_file))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	$list = unserialize(file_get_contents($list_file));

	unset($list[$item_id]);
	
	file_put_contents($list_file, serialize($list), LOCK_EX);
	
	echo 'OK';
	echo digest($list_file);
	exit();
}

function SORTITEMS()
{
	if (empty($_POST['listid']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}

	$id = $_POST['listid'];
	
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	$lists = array();

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));

	if (!array_key_exists($id, $lists))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	$list_file = file_build_path(LISTS_DIR, $id);

	$list = array();

	if (file_exists($list_file))
		$list = unserialize(file_get_contents($list_file));
		
	uasort($list, 'sort_list_by_checked');
	
	file_put_contents($list_file, serialize($list), LOCK_EX);
	
	echo 'OK';
	exit();
}

function CHANGESORT()
{
	if (empty($_POST['listid']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_LIST_ID', array(), FALSE);
		return;
	}

	if (empty($_POST['neworder']))
	{
		http_response_code(500);
		echo __('T_ERR_MISSING_NEW_ORDER', array(), FALSE);
		return;
	}

	$listid = $_POST['listid'];
	$new_order = array_filter(explode('/', $_POST['neworder']));
	$lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

	$lists = array();

	if (file_exists($lists_file))
		$lists = unserialize(file_get_contents($lists_file));

	if (!array_key_exists($listid, $lists))
	{
		http_response_code(500);
		echo __('T_ERR_LIST_NO_LONGER_EXISTING', array(), FALSE);
		exit();
	}
	
	$list_file = file_build_path(LISTS_DIR, $listid);

	$list = array();

	if (file_exists($list_file))
		$list = unserialize(file_get_contents($list_file));
		
	$newlist = array();
	foreach ($new_order as $itemid)
	{
		if (!array_key_exists($itemid, $list))
			continue;
		
		$newlist[$itemid] = $list[$itemid];
	}
	
	if (count($newlist) != count($list))
	{
		http_response_code(500);
		echo __('T_ERR_NEW_ORDER_INVALID', array(), FALSE);
		exit();
	}
	
	$list = $newlist;
	unset($newlist);
	
	file_put_contents($list_file, serialize($list), LOCK_EX);
	
	echo 'OK';
	echo digest($list_file);
	exit();
}

function mb_strcasecmp($str1, $str2, $encoding = 'UTF-8')
{
	return strcmp(mb_strtoupper($str1, $encoding), mb_strtoupper($str2, $encoding));
}

function sort_list_by_checked(array $a, array $b)
{
	if ($a['checked'] && !$b['checked']) return 1;
	if (!$a['checked'] && $b['checked']) return -1;
	return mb_strcasecmp($a['item'], $b['item']);
}