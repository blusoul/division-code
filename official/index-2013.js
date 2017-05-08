const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

// 国家统民政局数据
const url = 'http://files2.mca.gov.cn/cws/201404/20140404125738290.htm';
const writeJSON = fs.createWriteStream(__dirname + '/data/list-2013.json', {
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
    if (index > 1) {
      let tdList = $(item).find('td');
      let code = tdList.eq(0).text().trim();
      let name = tdList.eq(1).text().trim();

      if (code) {
        listJSON[code] = name;
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