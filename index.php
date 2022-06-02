<?php define('IN_LIST', true);
require_once ('init.php'); ?>
<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?php echo __('T_PAGE_TITLE'); ?></title>
        <link rel="stylesheet" href="support/normalize.css">
        <link rel="stylesheet" href="support/la/css/la.css">
        <link rel="stylesheet" href="support/style.css?<?php echo filemtime('support/style.css'); ?>">
        <script src="support/script.js?<?php echo filemtime('support/script.js'); ?>"></script>
        <link rel="shortcut icon" href="support/favicon.ico">
        <link rel="apple-touch-icon" href="support/apple-touch-icon.png">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="<?php echo __('T_PAGE_TITLE'); ?>">
    </head>
    <body>
        <noscript><h1><?php echo __('T_REQUIRES_JAVASCRIPT'); ?></h1></noscript>
        
        <div id="loading"><div></div></div>
        
        <div id="content">
            <div class="head">
                <h1></h1>
                <div><a title="<?php echo __('T_BUTTON_ADDTOGGLE'); ?>" class="addtogglebutton"><i class="las la-plus"></i></a></div>
                <div><a title="<?php echo __('T_BUTTON_SORT'); ?>" class="sortbutton"><i class="las la-sort-alpha-down"></i></a></div>
                <div><a title="<?php echo __('T_BUTTON_BACK'); ?>" class="backbutton"><i class="las la-home"></i></a></div>
            </div>
            
            <div class="add">
                <input type="text" placeholder="" name="item">
            </div>
    
            <div id="lists"></div>
    
            <div id="items"></div>
        </div>
    
        <template id="tpl-list">
              <div class="item">
                  <div><input type="text"><span></span></div>
                  <div><a title="<?php echo __('T_BUTTON_SAVE'); ?>" class="save"><i class="las la-check-circle"></i></a></div>
                  <div><a title="<?php echo __('T_BUTTON_EDIT'); ?>" class="edit"><i class="las la-pen"></i></a></div>
                  <div><a title="<?php echo __('T_BUTTON_ERASE'); ?>" class="erase"><i class="las la-times-circle"></i></a></div>
              </div>
        </template>
        
        <template id="tpl-item">
              <div class="item" draggable="true">
                  <div><input type="text"><span></span></div>
                  <div class="sortcontainer"><a title="<?php echo __('T_BUTTON_SORT'); ?>" class="sort"><i class="las la-sort"></i></a></div>
                  <div><a title="<?php echo __('T_BUTTON_SAVE'); ?>" class="save"><i class="las la-check-circle"></i></a></div>
                  <div><a title="<?php echo __('T_BUTTON_EDIT'); ?>" class="edit"><i class="las la-pen"></i></a></div>
                  <div><a title="<?php echo __('T_BUTTON_ERASE'); ?>" class="erase"><i class="las la-times-circle"></i></a></div>
              </div>
        </template>
    
        <div id="modal">
            <div>
                <div>
                    <p id="modaltitle"></p>
                    <p id="modalcontent"></p>
                    <button id="modalbutton" onclick="window.kaimonokun.closeModal()"><?php echo __('T_BUTTON_CLOSE'); ?></button>
                </div>
            </div>
        </div>
        
        <script>
            var T_ALL_LISTS = <?php echo json_encode(T_ALL_LISTS); ?>;
            var T_WRITE_ITEM_TEXT = <?php echo json_encode(T_WRITE_ITEM_TEXT); ?>;
            var T_WRITE_LIST_TEXT = <?php echo json_encode(T_WRITE_LIST_TEXT); ?>;
            var T_LIST_WAS_DELETED_TITLE = <?php echo json_encode(T_LIST_WAS_DELETED_TITLE); ?>;
            var T_LIST_WAS_DELETED = <?php echo json_encode(T_LIST_WAS_DELETED); ?>;
            var T_AJAX_ERROR_TITLE = <?php echo json_encode(T_AJAX_ERROR_TITLE); ?>;
            var T_AJAX_ERROR_GENERIC_TEXT = <?php echo json_encode(T_AJAX_ERROR_GENERIC_TEXT); ?>;
            var T_EVENTSOURCE_ERROR_TITLE = <?php echo json_encode(T_EVENTSOURCE_ERROR_TITLE); ?>;
            var T_EVENTSOURCE_ERROR_GENERIC_TEXT = <?php echo json_encode(T_EVENTSOURCE_ERROR_GENERIC_TEXT); ?>;
            
            window.kaimonokun = new kaimonokun(<?php echo json_encode(AUTHLINE); ?>);
        </script>
    </body>
</html>