const INSTANCE_CALENDAR_PATH = /^\/projects\/[^/]+\/calendar(?:\/|$)/;

export function getCalendarNavigationTarget(pathname: string): string {
  const match = pathname.match(INSTANCE_CALENDAR_PATH);
  return match ? match[0].replace(/\/$/, '') : '/calendar';
}

export function isCalendarRoute(pathname: string): boolean {
  return pathname === '/calendar' || pathname.startsWith('/calendar/') || INSTANCE_CALENDAR_PATH.test(pathname);
}

export function isProjectRoute(pathname: string): boolean {
  return pathname === '/projects' || pathname.startsWith('/projects/');
}
