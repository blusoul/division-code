const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');
const async = require('async');

const entryUrl = 'http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2015/index.html';
const writeJSON = fs.createWriteStream(__dirname + '/data/list-2015.json');

// 待写入的JSON数据
let listJSON = {};

// 相对路径地址转换
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
  captureProvince($) {
    const linkList = $('.provincetr a');
    let provinceArr = [];

    linkList.map((index, item) => {
      // 循环 10 个省份能完好异步执行，超过异步失效，找不到原因
      // if (index < 10) {
      const $item = $(item);
      provinceArr.push({
        url: combineLink({
          originUrl: entryUrl,
          spliceUrl: $item.attr('href')
        }),
        name: $item.text().trim()
      });
      // }
    });
    return provinceArr;
  },
  captureCity($) {
    const cityList = $('.citytr');
    let provinceCode = 0;
    let cityUrlArr = [];

    cityList.map((index, item) => {
      const linkNodes = $(item).find('td');
      const code = linkNodes.eq(0).text().trim().substr(0, 9);
      const name = linkNodes.eq(1).text().trim();
      const url = linkNodes.eq(0).find('a').attr('href');

      // 写入省份与直辖市区划
      if (!provinceCode) {
        provinceCode = code.substr(0, 2) + '0000000';
        listJSON[provinceCode] = $.provinceName;
      }

      // 去除直辖市级的或者省级无用的标识
      if (!/(市辖区|县|省直辖县级行政区划|自治区直辖县级行政区划)/.test(name)) {
        listJSON[code] = name;
      }
      cityUrlArr.push(combineLink({
        originUrl: $.href,
        spliceUrl: url
      }));

    });

    return cityUrlArr;
  },
  captureCountry($, cityUrl) {
    const cityList = $('.countytr');
    let areaUrlArr = [];

    cityList.map((index, item) => {
      const linkNodes = $(item).find('td');
      const code = linkNodes.eq(0).text().trim().substr(0, 9);
      const name = linkNodes.eq(1).text().trim();
      const url = linkNodes.eq(0).find('a').attr('href');

      // 去掉无用的市辖区字样
      if (!/市辖区/.test(name)) {
        listJSON[code] = name;
      }
      if (url) {
        areaUrlArr.push(combineLink({
          originUrl: $.href,
          spliceUrl: url
        }));
      }
    });

    return areaUrlArr;
  },
  captureTown($) {
    const cityList = $('.towntr');

    cityList.map((index, item) => {
      const linkNodes = $(item).find('a');
      const code = linkNodes.eq(0).text().trim().substr(0, 9);
      const name = linkNodes.eq(1).text().trim();
      // 替换街道一级有办事处字样，
      listJSON[code] = name.replace('办事处', '');
    });
    return true;
  },
  deal(res, entryUrl) {
    let i = 0;
    const provinceArr = this.captureProvince(res);

    Promise.all(provinceArr.map(item => {
        const provinceName = item.name;
        const provinceUrl = item.url;
        return new Promise(resolve => {
          captureUrl(provinceUrl, resolve, provinceName);
        })
      }))
      .then(res => {
        let tempArr = [];
        res.map(item => {
          // 解析市一级数据
          tempArr = tempArr.concat(this.captureCity(item, item.href))
        });

        return new Promise(resolve => {
          async.mapLimit(tempArr, 10, function (item, callback) {
            let temp = [];
            captureUrl(item, function ($) {
              console.log(item);
              // 解析区县一级数据
              temp = temp.concat(parseHtml.captureCountry($));
              callback(null, temp);
            });
          }, function (err, result) {
            let tempArr = [];
            result.map(item => {
              tempArr = tempArr.concat(item);
            });
            resolve(tempArr);
          });
        });

      }).then(res => {
        return new Promise(resolve => {
          async.mapLimit(res, 10, function (item, callback) {
            let temp = [];
            captureUrl(item, function ($) {
              console.log(item);

              // 解析街道或者乡镇一级数据
              parseHtml.captureTown($);
              // 省份超过 10 个 callback 无效。找不到原因，不得已写法
              // fs.createWriteStream(__dirname + '/data/list-2015.json').write(JSON.stringify(listJSON));
              callback(null);
            });
          }, function (err, result) {
            console.log(err)
            resolve(true)
          });
        });
      }).then(res => {
        // 所有请求完成后 callback 
        console.log('区划信息写入成功~')
        writeJSON.write(JSON.stringify(listJSON));
      }).catch(err => {
        console.log(err)
      });
  }
};

function captureUrl(url, fn, provinceName) {
  request.get({
    url: url,
    encoding: null //让body 直接是buffer
  }, (error, response, body) => {
    if (!error && response.statusCode == 200) {

      // 页面转码
      const convertedHtml = iconv.decode(body, 'gb2312');

      // 转换成 jQuery 对象
      const $ = cheerio.load(convertedHtml, {
        decodeEntities: false
      });
      $.href = url;
      $.provinceName = provinceName;
      fn($);
    }
    if (error) {
      console.log('error: ' + url)
    }
  });
}

captureUrl(entryUrl, function (res) {
  parseHtml.deal(res, entryUrl);
});