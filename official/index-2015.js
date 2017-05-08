const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');

const entryUrl = 'http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2015/index.html';
const writeJSON = fs.createWriteStream(__dirname + '/data/list-2015.json');

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
  captureProvince($) {
    const linkList = $('.provincetr a');
    let provinceArr = [];

    linkList.map((index, item) => {
      const $item = $(item);

      provinceArr.push({
        url: combineLink({
          originUrl: entryUrl,
          spliceUrl: $item.attr('href')
        }),
        name: $item.text().trim()
      });
    });
    return provinceArr;
  },
  captureCity($, provinceUrl, provinceName) {
    const cityList = $('.citytr');
    let provinceCode = 0;
    let cityUrlArr = [];

    cityList.map((index, item) => {
      const linkNodes = $(item).find('td');
      const code = linkNodes.eq(0).text().trim();
      const name = linkNodes.eq(1).text().trim();
      const url = linkNodes.eq(0).find('a').attr('href');

      if (!provinceCode) {
        provinceCode = code.substr(0, 2) + '0000000000';
        listJSON[provinceCode] = provinceName;
      }

      listJSON[code] = name;
      cityUrlArr.push(combineLink({
        originUrl: provinceUrl,
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
      const code = linkNodes.eq(0).text().trim();
      const name = linkNodes.eq(1).text().trim();
      const url = linkNodes.eq(0).find('a').attr('href');

      listJSON[code] = name;
      if (url) {
        areaUrlArr.push(combineLink({
          originUrl: cityUrl,
          spliceUrl: url
        }));
      } else {
        console.log(name + '-----' + code)
      }
    });

    return areaUrlArr;
  },
  captureTown($) {
    const cityList = $('.towntr');

    cityList.map((index, item) => {
      const linkNodes = $(item).find('a');
      const code = linkNodes.eq(0).text().trim();
      const name = linkNodes.eq(1).text().trim();

      listJSON[code] = name;
    });
  },
  deal(res, entryUrl) {
    let i = 0;
    const provinceArr = this.captureProvince(res);

    Promise.all(provinceArr.map(item => {
        const provinceName = item.name;
        const provinceUrl = item.url;
        return captureUrl(provinceUrl);
      }))
      .then(res => {
        let tempArr = [];
        res.map(item => {
          tempArr = tempArr.concat(this.captureCity(item, item.href))
        });

        return tempArr;
      })
      .then(res => {
        console.log(listJSON)
        return Promise.all(res.map(cityUrl => {
          console.log(i++)
          return captureUrl(cityUrl);
        }))
      })
      .then(res => {
        let tempArr = [];
        res.map(item => {
          tempArr = tempArr.concat(this.captureCountry(item, item.href))
        });
        return tempArr;
      }).then(res => {
        console.log(res)
      }).catch(err => {
        console.log(err)
      });


    // Promise.all(provinceArr.map(item => {

    //   const provinceName = item.name;
    //   const provinceUrl = item.url;
    //   return captureUrl(provinceUrl).then($ => {

    //     const cityUrlArr = this.captureCity({
    //       $,
    //       provinceName,
    //       provinceUrl
    //     });

    //     return Promise.all(cityUrlArr.map(cityUrl => {

    //       return captureUrl(cityUrl).then(res => {

    //         const countryUrlArr = this.captureCountry(res, cityUrl);

    //         return Promise.all(countryUrlArr.map(countryUrl => {

    //           return captureUrl(countryUrl).then(res => {
    //             this.captureTown(res);
    //           })

    //         })).then(res => {
    //           console.log(res);
    //         })
    //       });
    //     }));
    //   });
    // })).then(res => {
    //   console.log(222)
    //   writeJSON.write(JSON.stringify(listJSON));
    // }).catch(err => {
    //   console.log(err)
    // });
  }

};

setTimeout(function () {
  writeJSON.write(JSON.stringify(listJSON));
}, 60000)

function captureUrl(url) {
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
        $.href = url;
        resolve($);
      }
      if (error) {
        console.log(url)
      }
    });
  });
}

// 获取博雅地名网数据
captureUrl(entryUrl).then(res => {
  // console.log(res)
  parseHtml.deal(res, entryUrl);
}).catch(res => {

});