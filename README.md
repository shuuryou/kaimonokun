![](https://github.com/shuuryou/kaimonokun/blob/main/DONT_UPLOAD_TO_YOUR_WEBSITE/readme-screenshot/logo.png?raw=true)
# 買い物くん
パソコンとスマートフォン用の買い物リストのウェブアプリです。15時間ほどでささっと作ったので、完ぺきではないと思います。

お友達、パートナー、同居人等と一緒に同時にアクセス・使うことができます。編集はほぼリアルタイムで他のユーザーにも反映されます。

リストの数、リスト内のアイテム数は無制限です。

リストやアイテムの作成、編集、削除ができます。アイテムは上下に移動でき自由に並べ替えれます。買ったアイテムをチェックするには、クリックまたはタップします。買ったアイテムをリストの下に移動するには、A-Zボタンを押します。そうすることでまだ買っていないアイテムが上に表示されます。

パソコンのブラウザではブックマークを作成し、AndroidやiOSではホーム画面にピン留めすることで、素早くアクセスすることができます。

なお、インターネットの接続が不安定になると不具合が発生する可能性があります。また、2人のユーザーが同時に同じアイテムを編集する場合、最後に保存されたほうが保持されます。このアプリの「お客様」は元々私と私の同居人の2人だけなので、ご了承ください。

作成時には、Firefox 78、Chrome 89、Safari 14、Firefox for Android 91.2.0 でテストしました。このアプリはとてもシンプルなので、他のブラウザでも大丈夫だと思います。ただし、Internet Explorerには対応していません。

このアプリを使うには、サーバーでPHP 7と`mb_string`拡張が必要です。リストのデータを格納するフォルダは書き込み可能である必要があります。Windows（XAMPP等）および Linux（nginx + php_fcgi等）で作動します。WebサーバーやPHPの設定はご自身でお願いします。

認証は`auth`というGETパラメータで行います。`config.php`の`AUTHLINE`にパスワードを入力してください。より高いセキュリティが必要な場合は、ウェブサーバの設定をご参照ください。

日本語フォントが重いため、最初の読み込みに時間がかかります。「あくび印」フォントはAkubi-Zirushiさんから無断で使用したものです。フォント作成者のウェブサイトはもう存在しておらず、許可を得ることができませんでした。

## 使用方法
### リスト画面

リスト画面で **＋** をタップ。赤いテキストボックスにリストの名前を入力。

![](https://github.com/shuuryou/kaimonokun/blob/main/DONT_UPLOAD_TO_YOUR_WEBSITE/readme-screenshot/screen1.png?raw=true)

鉛筆ボタンでリストの名前を編集。**✕** はリストを削除（元に戻せないため注意）。

リストの名前をタップするとアイテム一覧が表示。

![](https://github.com/shuuryou/kaimonokun/blob/main/DONT_UPLOAD_TO_YOUR_WEBSITE/readme-screenshot/screen2.png?raw=true)

### アイテム画面

アイテム画面もリスト画面と同じ使い方。

アイテムを追加するには、同様 に**＋**をタップ。赤いテキストボックスに、アイテムの名を入力。

鉛筆ボタンでアイテム名を編集。**✕** はアイテムを削除（元に戻せないため注意）。

アイテム名をタップすると完了にします。買い物が完了したアイテムは赤い取り消し線が入ります。

一番上の **A-Z** ボタンは、アイテムをアルファベット順に並べ替え、さらに買い物が完了したアイテムを一番下に配置させます。

ホームボタンでリスト画面に戻ります。

![](https://github.com/shuuryou/kaimonokun/blob/main/DONT_UPLOAD_TO_YOUR_WEBSITE/readme-screenshot/screen3.png?raw=true)

__楽々使えると思います。ヽ(*・ω・)ﾉ__

## 名前について
買い物くんは元々**STUPID LIST**という名前でした。今まで使っていたTODOリストアプリがあまりにもひどかったので、何回も*STUPID LIST*呼ばわりしてました。そんな思いをしたので、自分の*STUPID LIST*を作ることにしました。

しかし、私の同居人は*STUPID*という名前が気に入らなかったようなので、もっと優しい名前にしました。
