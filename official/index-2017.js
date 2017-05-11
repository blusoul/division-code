const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

// 国家统民政局数据
const url = 'http://www.mca.gov.cn/article/sj/tjbz/a/2017/201703/201705051139.html';
const writeJSON = fs.createWriteStream(__dirname + '/data/list-2017.json', {
    flags: 'w',
    defaultEncoding: 'utf8',
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

function parseHtml(str) {
    // 解析 HTML
    const $ = cheerio.load(str);
    const nodeList = Array.from($('tr'));

    nodeList.map((item, index) => {
        let tdList = $(item).find('td');
        if (tdList[1]) {
            zoningCode = $(tdList[1]).text().trim();
            // 区划代码为数字
            if (/^\d{6}$/.test(zoningCode)) {
                tempStr = $(tdList[2]).text().trim();
                if (zoningCode.substr(-4) == 0) {

                    // 省区划代码最后四位都是 0 比如： 130000 河北省 
                    setCode.setProvinceCode();
                    // 省区划代码作为 key
                    provinceCode = zoningCode;

                    // 当为北京，天津，上海，重庆四个直辖市，复制一份作为市一级
                    if (/(110000|120000|310000|500000)/.test(zoningCode)) {
                        cityCode = zoningCode;
                        setCode.setCityCode();
                    }
                } else if (zoningCode.substr(4, 6) === '00') {
                    // 市级区划代码最后两位都是 0 比如： 130100 石家庄市
                    cityCode = zoningCode;
                    setCode.setCityCode();
                } else {
                    if (zoningCode.substr(2, 4) === '90') {
                        // 省直辖县级行政区划 或 自治区直辖县级行政区划 的代码 第三四位为 90 比如 659001 石河子市 429004 仙桃市
                        // 此类市没有下一级目录，需要自己添加
                        setCode.setCityCode();
                    } else {
                        setCode.setAreaCode();
                    }
                }
            }
        }
    });

    // 循环结束, 写入文件
    writeJSON.write(JSON.stringify(listJSON));
    console.log('区划数据写入成功~~\n Path:' + __dirname + '\\data\\list.json');
}

// 请求民政局页面
request(url, (error, response, body) => {
    if (response.statusCode == 200) {
        parseHtml(body);
    } else {
        console.log(error);
    }
});