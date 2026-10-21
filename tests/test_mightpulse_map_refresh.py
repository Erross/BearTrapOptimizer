import unittest
from scripts.mightpulse_map_refresh import MapRefreshError, warm_map, location_age_seconds


class Clock:
    def __init__(self):
        self.value = 0
        self.pauses = []

    def now(self):
        return self.value

    def pause(self, seconds):
        self.value += seconds
        self.pauses.append(seconds)


class Element:
    def __init__(self, page, selector):
        self.page, self.selector = page, selector

    def wait_for(self, **kwargs):
        pass

    def inner_text(self):
        p = self.page
        if self.selector == 'body':
            return p.body
        if self.selector == '#mapFreshness':
            age = p.age if p.clock.value >= 300 else '3 days, 6h ago'
            return 'Last Location Update\n' + age + '\nLast Shield Update\n' + age
        if self.selector == '#btnUpdateMap':
            return p.final if p.clock.value >= 300 else p.initial
        return ''

    def is_enabled(self):
        return self.page.initial == 'Update Map Ready'

    def is_visible(self):
        return False

    def click(self):
        self.page.clicks += 1


class Page:
    def __init__(self, clock, initial='Update Map Ready', final='Update Map Wait 28m', age='1m ago', body='Kingdom 2399', status=200):
        self.clock, self.initial, self.final, self.age, self.body, self.status = clock, initial, final, age, body, status
        self.clicks = 0

    def goto(self, url, **kwargs):
        assert url == 'https://mightpulse.com/map?kid=2399'
        return self

    def locator(self, selector):
        return Element(self, selector)


class MapRefreshTests(unittest.TestCase):
    def test_opens_fixed_map_clicks_once_and_keeps_it_open_for_five_minutes(self):
        clock = Clock()
        page = Page(clock)
        result = warm_map(page, clock.pause, clock.now)
        self.assertEqual(page.clicks, 1)
        self.assertEqual(result['waited_seconds'], 300)
        self.assertEqual(clock.value, 300)
        self.assertLessEqual(max(clock.pauses), 30)
        self.assertIn('1m ago', result['after'])

    def test_existing_cooldown_or_active_refresh_does_not_click_again(self):
        for initial in ['Update Map Wait 29m', 'Queued Next up']:
            clock = Clock()
            page = Page(clock, initial=initial, age='7m ago')
            warm_map(page, clock.pause, clock.now)
            self.assertEqual(page.clicks, 0)
            self.assertEqual(clock.value, 300)

    def test_pending_or_failed_refresh_blocks_api_import(self):
        for final in ['Queued Next up', 'Updating', 'Refresh failed']:
            clock = Clock()
            with self.subTest(final=final), self.assertRaises(MapRefreshError):
                warm_map(Page(clock, final=final), clock.pause, clock.now)

    def test_stale_and_unknown_location_times_block_api_import(self):
        for age in ['3 days, 6h ago', 'unknown', '—', '45m ago']:
            clock = Clock()
            with self.subTest(age=age), self.assertRaises(MapRefreshError):
                warm_map(Page(clock, age=age), clock.pause, clock.now)

    def test_http_errors_or_human_verification_stop_without_clicking(self):
        for change in [dict(status=403), dict(body='Verify you are human')]:
            clock = Clock()
            page = Page(clock, **change)
            with self.assertRaises(MapRefreshError):
                warm_map(page, clock.pause, clock.now)
            self.assertEqual(page.clicks, 0)
            self.assertEqual(clock.value, 0)

    def test_visible_age_formats(self):
        for text, seconds in [('just now', 0), ('21s ago', 21), ('5m ago', 300), ('3 days, 6h ago', 280800)]:
            self.assertEqual(location_age_seconds('Last Location Update\n'+text+'\nLast Shield Update\n—'), seconds)
