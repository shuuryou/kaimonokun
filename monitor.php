<?php
define('IN_LIST', true);
require_once ('init.php');

define('MAX_RUNTIME', 300);

header('Content-Type: text/event-stream');
header('Cache-Control: private, no-cache, no-store, max-age=0, no-transform');
header('Access-Control-Allow-Origin: *');
header('X-Accel-Buffering: no');

set_time_limit(MAX_RUNTIME);

$start = microtime(true);

while (ob_get_level() > 0) ob_end_clean();

if (empty($_GET['watch']))
{
    http_response_code(500);
    echo __('T_ERR_MISSING_WATCH', array() , false);
    return;
}

$watch = $_GET['watch'];

if (strtoupper($watch) == 'LISTS')
{
    $watch = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);
}
else
{
    $lists_file = file_build_path(LISTS_DIR, LIST_INDEX_FILENAME);

    $lists = array();

    if (file_exists($lists_file)) $lists = unserialize(file_get_contents($lists_file));

    if (!array_key_exists($watch, $lists))
    {
        http_response_code(500);
        echo __('T_ERR_LIST_NO_LONGER_EXISTING', array() , false);
        exit();
    }

    unset($lists);
    unset($lists_file);

    $watch = file_build_path(LISTS_DIR, $watch);
}

if (!empty($_SERVER["HTTP_LAST_EVENT_ID"]))
    $last_digest = trim($_SERVER["HTTP_LAST_EVENT_ID"]);
else
    // Force one "update" so that when the EventSource connects it will get
    // an event. This is required because the EventSource disconnects when
    // the tab with the list is not in focus and someone else could be
    // changing it during that time.
    $last_digest = NULL;

flush();

while (true)
{
    $time_elapsed_secs = microtime(true) - $start;

    if ((MAX_RUNTIME - $time_elapsed_secs) < 10) exit();

    $new_digest = digest($watch);

    if ($new_digest != $last_digest)
    {
        $last_digest = $new_digest;
        echo sprintf("event: message\n");
        echo sprintf("id: %s\n", $new_digest);
        echo sprintf("data: %s\n", $new_digest);
        echo "\n";
        flush();
    }
    else
    {
        // This is to detect aborted fcgi connections
        echo ":\n\n";
        flush();
        sleep(3);
    }
}