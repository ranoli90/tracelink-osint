import { UAParser } from 'ua-parser-js';

const parser = new UAParser();

export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      deviceType: 'Unknown',
      browser: 'Unknown',
      browserVersion: null,
      os: 'Unknown',
      osVersion: null,
      deviceBrand: null,
      deviceModel: null,
    };
  }

  parser.setUA(userAgent);
  const result = parser.getResult();

  const deviceType = getDeviceType(result);
  const { brand, model } = getDeviceBrandModel(result, userAgent);

  return {
    deviceType,
    browser: result.browser?.name || 'Unknown',
    browserVersion: result.browser?.version || null,
    os: result.os?.name || 'Unknown',
    osVersion: result.os?.version || null,
    deviceBrand: brand,
    deviceModel: model,
  };
}

function getDeviceBrandModel(result, userAgent) {
  const ua = userAgent.toLowerCase();
  
  if (result.device?.vendor || result.device?.model) {
    return {
      brand: result.device.vendor || null,
      model: result.device.model || null,
    };
  }
  
  const brandPatterns = [
    { brand: 'Samsung', pattern: /samsung|sm-/i },
    { brand: 'Apple', pattern: /iphone|ipad|ipod|macintosh/i },
    { brand: 'Huawei', pattern: /huawei|honor|mate/i },
    { brand: 'Xiaomi', pattern: /xiaomi|redmi|poco|mi\s/i },
    { brand: 'OPPO', pattern: /oppo|realme|oneplus/i },
    { brand: 'Vivo', pattern: /vivo/i },
    { brand: 'Motorola', pattern: /moto|x/i },
    { brand: 'Google', pattern: /pixel/i },
    { brand: 'LG', pattern: /lg\s/i },
    { brand: 'Nokia', pattern: /nokia|hmd/i },
    { brand: 'Sony', pattern: /sony|xperia/i },
    { brand: 'Asus', pattern: /asus|zenfone/i },
    { brand: 'Lenovo', pattern: /lenovo|legion/i },
  ];
  
  for (const { brand, pattern } of brandPatterns) {
    if (pattern.test(ua)) {
      let model = null;
      const modelMatch = ua.match(/(?:sm-|iphone|ipad|mate |redmi |poco |mi )?([a-z0-9]+)/i);
      if (modelMatch) {
        model = modelMatch[1];
      }
      return { brand, model };
    }
  }
  
  return { brand: null, model: null };
}

function getDeviceType(result) {
  const type = result.device?.type;
  
  if (type === 'mobile') return 'Mobile';
  if (type === 'tablet') return 'Tablet';
  if (type === 'smarttv') return 'Smart TV';
  if (type === 'console') return 'Console';
  if (type === 'wearable') return 'Wearable';
  
  if (result.os?.name && ['Windows', 'Mac OS', 'Linux', 'Chrome OS', 'Ubuntu', 'Fedora'].includes(result.os.name)) {
    return 'Desktop';
  }
  
  return 'Desktop';
}