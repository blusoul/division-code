const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');
const async = require('async');

let updateUrlArr = [];
let len = 0;
const update2015Url = 'http://www.mca.gov.cn/article/sj/tjbz/a/2015/below/201602/20160200880232.htm';
const update2016Url = 'http://www.mca.gov.cn/article/sj/tjbz/a/2016/0331/2016%E5%B9%B412%E6%9C%88%E5%8E%BF%E4%BB%A5%E4%B8%8B%E5%8C%BA%E5%88%92%E5%8F%98%E6%9B%B4%E6%83%85%E5%86%B5.html';
const update2017EntryUrl = 'http://www.mca.gov.cn/article/sj/tjbz/a/2017/';
const originData = {};
const writeJSON = fs.createWriteStream(__dirname + '/data/list-update.json');

// 待写入的JSON数据
let listJSON = {};

function combineLink({
    originUrl,
    spliceUrl
}) {
    if (typeof originUrl == 'string' && /^http/.test(originUrl)) {
        const lastIndex = originUrl.lastIndexOf('/');
        return originUrl.substr(0, lastIndex + 1) + spliceUrl;
    }
}

const parseHtml = {
    getChangeData($) {
        const trList = $('tr');
        trList.map((index, item) => {
            const tdList = $(item).find('td');
            const trList = this.getInnerText(tdList);
            if (parseInt(trList(0), 10)) {

                const originCode = trList(1);
                const originName = trList(2);
                let changeCode;
                let changeName;

                if (/[\u4e00-\u9fa5]/.test(trList(3))) {
                    changeCode = trList(4);
                    changeName = trList(5);
                } else {
                    changeCode = trList(3);
                    changeName = trList(4);
                }
                if (originCode && originName) {
                    if (originData[originCode]) {
                        delete originData[originCode];
                    } else {
                        console.log('remove ' + originCode + '--&--' + originName + ' error');
                    }
                }
                if (changeCode && changeName) {
                    if (!(originData[changeCode] && originData[changeCode] == changeName)) {
                        originData[changeCode] = changeName;
                    } else {
                        console.log('add ' + changeCode + '--&--' + changeName + ' error')
                    }
                }
            }
        });
    },
    getInnerText(list) {
        return function (i) {
            return list.eq(i).text().trim();
        }
    },
    getChangeUrl($) {
        const $urlList = $('.article a');
        let changeUrlArr = [];
        $urlList.map((index, item) => {
            const isNeedUrl = $(item).text().indexOf('县以下行政区划变更情况') > -1;
            if (isNeedUrl) {
                changeUrlArr.push('http://www.mca.gov.cn/' + $(item).attr('href'));
            }
        });
        return changeUrlArr;
    },
    getRedirectUrl($) {
        const scriptText = $('script').eq(0).text().trim();
        const matchArr = scriptText.match(/^window.location.href="(\S*)";/);
        if (matchArr && matchArr[1]) {
            return matchArr[1];
        } else {
            console.log('重定向页面转换错误~')
        }
    },
    deal(res) {
        const update2017UrlArr = this.getChangeUrl(res);
        updateUrlArr.push(update2015Url, update2016Url)
        updateUrlArr = updateUrlArr.concat(update2017UrlArr);
        len = updateUrlArr.length;

        function loopFn() {
            return captureUrl(updateUrlArr[--len]);
        }
        loopFn().then(res => {
            this.getChangeData(res);
            return loopFn();
        }).then(res => {
            if (res.isRedirect) {
                const realUrl = this.getRedirectUrl(res);
                return captureUrl(realUrl);
            } else {
                this.getChangeData(res);
                return loopFn();
            }
        }).then(res => {
            if (res.isRedirect) {
                const realUrl = this.getRedirectUrl(res);
                return captureUrl(realUrl);
            } else {
                this.getChangeData(res);
                return loopFn();
            }
        }).catch(err => {

        });

    }

};


function captureUrl(url) {
    return new Promise((resolve) => {
        request.get({
            url: url,
        }, (error, response, body) => {
            if (!error && response.statusCode == 200) {
                const $ = cheerio.load(body, {
                    decodeEntities: false
                });
                // 是否有重定向
                const isRedirect = url.indexOf('.shtml') > -1;
                $.isRedirect = isRedirect;
                resolve($);
            }
            if (error) {
                console.log(url)
            }
        });
    });
}

captureUrl(update2017EntryUrl).then(res => {
    parseHtml.deal(res);
});