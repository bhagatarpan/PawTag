/**
 * User Agent Parser
 *
 * Parses browser name/version and device/OS from the user agent string.
 * No external dependencies — regex-based for the most common browsers and OS.
 */

export interface ParsedUserAgent {
  browser: string;
  device: string;
}

export function parseUserAgent(ua: string): ParsedUserAgent {
  if (!ua || ua === 'unknown') {
    return { browser: 'Unknown Browser', device: 'Unknown Device' };
  }

  // ─── Browser Detection ───
  let browser = 'Unknown Browser';

  if (ua.includes('Edg/')) {
    const version = ua.match(/Edg\/(\d+(?:\.\d+)*)/)?.[1]?.split('.')[0];
    browser = `Edge${version ? ` ${version}` : ''}`;
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    const version = ua.match(/(?:OPR|Opera)\/(\d+(?:\.\d+)*)/)?.[1]?.split('.')[0];
    browser = `Opera${version ? ` ${version}` : ''}`;
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const version = ua.match(/Chrome\/(\d+(?:\.\d+)*)/)?.[1]?.split('.')[0];
    browser = `Chrome${version ? ` ${version}` : ''}`;
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const version = ua.match(/Version\/(\d+(?:\.\d+)*)/)?.[1]?.split('.')[0];
    browser = `Safari${version ? ` ${version}` : ''}`;
  } else if (ua.includes('Firefox/')) {
    const version = ua.match(/Firefox\/(\d+(?:\.\d+)*)/)?.[1]?.split('.')[0];
    browser = `Firefox${version ? ` ${version}` : ''}`;
  }

  // ─── Device / OS Detection ───
  let device = 'Unknown Device';

  if (ua.includes('Windows NT 10.0')) {
    device = 'Windows 10';
  } else if (ua.includes('Windows NT 11.0') || (ua.includes('Windows') && ua.includes('10.0'))) {
    device = 'Windows 11';
  } else if (ua.includes('Windows')) {
    device = 'Windows';
  } else if (ua.includes('Mac OS X')) {
    const version = ua.match(/Mac OS X (\d+)[._](\d+)/);
    device = version ? `macOS ${version[1]}.${version[2]}` : 'macOS';
  } else if (ua.includes('iPhone')) {
    const version = ua.match(/iPhone OS (\d+)[._](\d+)/);
    device = version ? `iPhone (iOS ${version[1]}.${version[2]})` : 'iPhone';
  } else if (ua.includes('iPad')) {
    const version = ua.match(/OS (\d+)[._](\d+)/);
    device = version ? `iPad (iOS ${version[1]}.${version[2]})` : 'iPad';
  } else if (ua.includes('Android')) {
    const version = ua.match(/Android (\d+(?:\.\d+)*)/)?.[1];
    device = version ? `Android ${version}` : 'Android';
  } else if (ua.includes('Linux')) {
    device = 'Linux';
  } else if (ua.includes('CrOS')) {
    device = 'ChromeOS';
  }

  return { browser, device };
}
