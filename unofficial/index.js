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

// 区划代码补位至 9 位
function fixCode(code) {
  return typeof code == 'string' ? (code + '00000000').substr(0, 9) : code;
}

const parseHtml = {
  captureProvince($) {
    const linkList = Array.from($('img[name="china_map1"]').parent().next('div').find('a'));
    let provinceArr = [];

    linkList.filter((item, index) => {
      if (index < 31) {
        provinceArr.push($(item).attr('href'));
        return true;
      }
    });
    return provinceArr;
  },
  captureCity($) {
    const cityList = $('table[bgcolor="cccccc"]').eq(0).find('tr');
    const provinceName = $('#page_left a').eq(1).text().trim();
    let provinceCode = 0;
    let cityData = {};

    let areaArr = [];

    cityList.map((index, item) => {
      if (index > 0) {
        const tdList = $(item).find('td');
        const zoningCode = tdList.eq(4).text().trim();
        const nameNode = tdList.eq(0).find('a');
        const url = nameNode.attr('href');
        const name = nameNode.text().trim();
        if (!provinceCode) {
          provinceCode = fixCode(zoningCode.substr(0, 2));
          listJSON[provinceCode] = provinceName;
        }
        listJSON[fixCode(zoningCode)] = name;

        areaArr.push(url);
      }
    });

    return areaArr;
  },
  captureArea($) {
    const cityList = $('table[width="738"][bgcolor="cccccc"]').find('tr');
    let areaArr = [];

    cityList.map((index, item) => {
      const tdList = $(item).find('td');
      const nameNode = tdList.eq(0).find('a');
      if (nameNode.text()) {
        const zoningCode = tdList.eq(1).text().trim();

        const url = thirdPartUrl + nameNode.attr('href');
        const name = nameNode.text().trim();

        listJSON[fixCode(zoningCode)] = name;
        areaArr.push(url);
      }
    });
    return areaArr;
  },
  captureTown($) {
    const cityList = $('table[width="738"][bgcolor="cccccc"]').find('tr');
    let data;
    let code = 0;

    cityList.map((index, item) => {
      const tdList = $(item).find('td');
      const nameNode = tdList.eq(0).find('a');

      if (nameNode.text()) {
        const zoningCode = tdList.eq(1).text().trim();

        const url = thirdPartUrl + nameNode.attr('href');
        const name = nameNode.text().trim();

        if (zoningCode) {
          data[fixCode(zoningCode)] = name;
          if (!code) code = zoningCode.substr(0, 6);
        } else {

        }
      }
      if (index == cityList.length - 1) {
        fs.createWriteStream(__dirname + '/data/town/' + code + '.json').write(JSON.stringify(data));
      }
    });
    return {
      code,
      data
    };
  },
  deal(res) {
    const provinceArr = this.captureProvince(res);

    Promise.all(provinceArr.map(item => {

      return captureUrl(item).then(res => {

        const cityArr = this.captureCity(res);
        return Promise.all(cityArr.map(item => {
          return captureUrl(item).then(res => {

            const areaArr = this.captureArea(res);
            // return Promise.all(areaArr.map(item => {
            //   if (!/(chongqing|shanghai|tianjing|beijing)/.test(item)) {
            //     return captureUrl(item).then(res => {
            //       const {
            //         code,
            //         data
            //       } = this.captureTown(res);
            //       // fs.createWriteStream(__dirname + '/data/town/' + code + '.json').write(JSON.stringify(data));
            //     })
            //   }
            // }))
          });
        }));
      })
      // .then(res => {

      //   const cityArr = this.captureCity(res);
      //   Promise.all(cityArr.map(item => {

      //     return captureUrl(item).then(res => {

      //       const result = parseHtml.captureArea(res);

      //       fs.createWriteStream(__dirname + '/data/town/' + 1 + '.json').write(JSON.stringify(result));
      //     });
      //   })).then(res => {
      //     writeJSON.write(JSON.stringify(listJSON));
      //     console.log('写入区划代码成功~');
      //   })

      // });

    })).then(res => {
      console.log(222)
      writeJSON.write(JSON.stringify(listJSON));
    }).catch(err => {
      console.log(err)
    });
  }




};


function captureUrl(url) {
  return new Promise((resolve, reject) => {
    request.get({
      url: thirdPartUrl + url,
      encoding: null //让body 直接是buffer
    }, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        const convertedHtml = iconv.decode(body, 'gb2312');
        const $ = cheerio.load(convertedHtml, {
          decodeEntities: false
        });
        resolve($);
      }
      if (error) {
        console.log(url)
      }
    });
  });
}

// 获取博雅地名网数据
captureUrl('').then(res => {
  // console.log(res)
  parseHtml.deal(res);
}).catch(res => {

});