const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');


// 博雅地名网
const thirdPartUrl = 'http://www.tcmap.com.cn';
const writeJSON = fs.createWriteStream(__dirname + '/data/list.json', {
    flags: 'w',
    defaultEncoding: 'utf-8',
    fd: null,
    mode: 0o666,
    autoClose: true
});
const errorlog = fs.createWriteStream(__dirname + '/data/error.log', {
    flags: 'w',
    defaultEncoding: 'utf-8',
    fd: null,
    mode: 0o666,
    autoClose: true
});

// 待写入的JSON数据
let listJSON = {};

// 省区划代码临时变量
let provinceCode;

// 市区划代码临时变量
let cityCode;

// 区划代码
let zoningCode;

// 区划代码对应的字符串
let tempStr;

// 设置区划代码
const setCode = {
    setProvinceCode() {
        // 设置省区划代码
        listJSON[zoningCode] = {};
        listJSON[zoningCode].name = tempStr;
        listJSON[zoningCode].list = {};
    },
    setCityCode() {
        // 设置市区划代码
        listJSON[provinceCode].list[zoningCode] = {};
        listJSON[provinceCode].list[zoningCode].name = tempStr;
        listJSON[provinceCode].list[zoningCode].list = {};
    },
    setAreaCode() {
        // 设置区或县区划代码
        listJSON[provinceCode].list[cityCode].list[zoningCode] = {};
        listJSON[provinceCode].list[cityCode].list[zoningCode].name = tempStr;
    }
};

const parseHtml = {
    captureProvince(str) {
        // 解析 HTML
        const $ = cheerio.load(str, {
            decodeEntities: false
        });
        const linkList = Array.from($('img[name="china_map1"]').parent().next('div').find('a'));
        let abroadIndex;
        let provinceArr = [];

        linkList.filter(function (item, index) {
            var href = $(item).attr('href');
            var data = {
                name: $(item).text(),
                url: href
            };
            if ($(item).text() == '台湾') {
                abroadIndex = index;
            }
            if (abroadIndex) {
                if (index > abroadIndex) {
                    return false;
                } else {
                    provinceArr.push(data);
                    return true;
                }
            } else {
                provinceArr.push(data);
                return true;
            }
        });

        provinceArr.map((item, index) => {
            captureUrl({
                type: 'captureOther',
                url: thirdPartUrl + item.url
            })
        });
    },
    captureOther(str) {
        const $ = cheerio.load(str, {
            decodeEntities: false
        });
        const cityList = $('#page_left table').eq(0).find('tr');
        const provinceName = $('#page_left a').eq(1).text().trim();
        let cityData = {};

        cityData.name = provinceName;
        cityData.list = {};
        cityList.map((index, item) => {
            let provinceCode = 0;
            if (index > 0) {
                const tdList = $(item).find('td');
                const zoningCode = tdList.eq(4).text().trim();
                const nameNode = tdList.eq(0).find('a');
                const name = nameNode.text().trim();

                if (!zoningCode || cityData.list[zoningCode]) {
                    errorlog.write(provinceName + '----' + name + '----' + zoningCode + '\n');
                }
                cityData.list[zoningCode] = name;
                if (!provinceCode && zoningCode) provinceCode = zoningCode.slice(0, 2) + '0000';
            } else {

            }
            if (index == cityList.length - 1) {
                listJSON[provinceCode] = cityData;
            }
        });

    }
};


function captureUrl({
    type,
    url
}) {
    request.get({
        url: url,
        encoding: null //让body 直接是buffer
    }, function (err, response, body) {
        var convertedHtml = iconv.decode(body, 'gb2312');
        parseHtml[type](convertedHtml);
    });
}

// 获取博雅地名网数据
captureUrl({
    type: 'captureProvince',
    url: thirdPartUrl
});

setTimeout(function () {
    writeJSON.write(JSON.stringify(listJSON));
}, 20000);