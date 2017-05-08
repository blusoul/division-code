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

let flag = true;

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
  captureProvince($) {
    const linkList = Array.from($('img[name="china_map1"]').parent().next('div').find('a'));
    let provinceArr = [];

    linkList.filter((item, index) => {
      if (index < 31) {
        let data = {
          name: $(item).text().trim(),
          url: $(item).attr('href')
        };
        provinceArr.push(data);
        return true;
      }
    });

    Promise.all(provinceArr.map(item => {
      return captureUrl({
        url: thirdPartUrl + item.url
      }).then(res => {
        let {
          code,
          data
        } = parseHtml.captureCity(res);
        listJSON[code] = data;
      });
    })).then(() => {
      writeJSON.write(JSON.stringify(listJSON));
      console.log('写入区划代码成功~');
    }).catch(err => {
      console.log(err)
    });
  },
  captureCity($) {
    const cityList = $('#page_left table').eq(0).find('tr');
    const provinceName = $('#page_left a').eq(1).text().trim();
    let cityData = {};
    let provinceCode = 0;
    let areaArr = [];

    cityData.name = provinceName;
    cityData.list = {};

    cityList.map((index, item) => {
      if (index > 0) {
        const tdList = $(item).find('td');
        const zoningCode = tdList.eq(4).text().trim();
        const nameNode = tdList.eq(0).find('a');
        const url = nameNode.attr('href');
        const name = nameNode.text().trim();

        if (!zoningCode || cityData.list[zoningCode]) {
          errorlog.write(provinceName + '----' + name + '----' + zoningCode + '\n');
        }
        cityData.list[zoningCode] = name;
        if (!provinceCode && zoningCode) provinceCode = zoningCode.slice(0, 2) + '0000';

        areaArr.push({
          url: url,
          code: zoningCode
        });
      }
    });

    Promise.all(areaArr.map(item => {
      captureUrl({
        url: thirdPartUrl + item.url
      }).then(res => {
        const {
          code,
          data
        } = parseHtml.captureArea(res);
        cityData.list[code] = data;
      })
    })).then(() => {
      return {
        code: provinceCode,
        data: cityData
      };
    });
  },
  captureArea($) {
    const cityList = $('#page_left table').eq(1).find('tr');
    const provinceName = $('#page_left a').eq(2).text().trim();
    let cityData = {};
    let provinceCode = 0;

    cityData.name = provinceName;
    cityData.list = {};
    cityList.map((index, item) => {
      if (index > 0) {
        const tdList = $(item).find('td');
        const zoningCode = tdList.eq(1).text().trim();
        const nameNode = tdList.eq(0).find('a');
        const url = thirdPartUrl + nameNode.attr('href');
        const name = nameNode.text().trim();

        if (!zoningCode || cityData.list[zoningCode]) {
          errorlog.write(provinceName + '----' + name + '----' + zoningCode + '\n');
        }
        cityData.list[zoningCode] = name;
        if (!provinceCode && zoningCode) provinceCode = zoningCode.slice(0, 2) + '0000';
        // captureUrl(url).then(res => {
        //   this.captureArea(res);
        // })
      }
    });
    return {
      code: provinceCode,
      data: cityData
    };
  }
};


function captureUrl({
  url
}) {
  return new Promise((resolve, reject) => {
    request.get({
      url: url,
      encoding: null //让body 直接是buffer
    }, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        const convertedHtml = iconv.decode(body, 'gb2312');
        const $ = cheerio.load(convertedHtml, {
          decodeEntities: false
        });
        resolve($);
      }
    });
  });
}

// 获取博雅地名网数据
captureUrl({
  url: thirdPartUrl
}).then(res => {
  parseHtml['captureProvince'](res);
}).catch(res => {

});