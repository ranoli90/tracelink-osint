import { nanoid } from 'nanoid';

export function generateTrackingId() {
  return nanoid(10);
}

export function formatClickEvent(event) {
  return {
    id: event.id,
    trackingId: event.trackingId,
    timestamp: event.timestamp,
    location: {
      country: event.country,
      region: event.region,
      city: event.city,
    },
    device: {
      type: event.deviceType,
      browser: event.browser,
      browserVersion: event.browserVersion,
      os: event.os,
      osVersion: event.osVersion,
    },
    network: {
      ipTruncated: event.ipTruncated,
    },
    metadata: {
      language: event.language,
      referrer: event.referrer,
      fingerprintHash: event.fingerprintHash,
    },
  };
}

export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}