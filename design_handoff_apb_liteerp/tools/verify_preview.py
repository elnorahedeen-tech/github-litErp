#!/usr/bin/env python3
"""Exercise the standalone handoff only, with a loopback static server."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

PACK = Path(__file__).resolve().parents[1]
OUT = PACK / 'verification'
OUT.mkdir(exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(PACK)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    checks, errors, external, posts = [], [], [], []
    report = {'scope': 'synthetic style preview, no ERP/APB backend', 'checks': checks}
    try:
        with sync_playwright() as p:
            executable = os.environ.get('APB_CHROMIUM_EXECUTABLE')
            browser = p.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
            report['browser'] = browser.version
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN', timezone_id='Asia/Shanghai')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            def intercept(route):
                request = route.request
                if not request.url.startswith(base + '/'):
                    external.append(request.url); route.abort()
                else:
                    if request.method != 'GET': posts.append(request.method + ' ' + request.url)
                    route.continue_()
            context.route('**/*', intercept)
            page.goto(base + '/preview/index.html')
            expect(page.locator('#order-rows tr')).to_have_count(4)
            expect(page.locator('#result-status')).to_contain_text('共 6 单')
            page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)
            checks.append('desktop shell and data table render')

            page.locator('#order-rows input').first.check()
            assert page.locator('#select-page').evaluate('(e) => e.indeterminate')
            page.locator('#select-page').check()
            expect(page.locator('#selection-status')).to_contain_text('已选择 4 单')
            page.locator('#next-page').click()
            expect(page.locator('#order-rows tr')).to_have_count(2)
            expect(page.locator('#selection-status')).to_contain_text('选择已清除')
            page.reload()
            expect(page.locator('#page-number')).to_have_text('第 2 / 2 页')
            page.locator('#previous-page').click()
            expect(page.locator('#page-number')).to_have_text('第 1 / 2 页')
            page.locator('#next-page').click()
            checks.append('page selection, mixed checkbox, cleared selection and URL refresh')

            search = page.locator('#order-search')
            search.dispatch_event('compositionstart')
            search.fill('海棠')
            page.wait_for_timeout(350)
            expect(page.locator('#order-rows tr')).to_have_count(2)
            search.dispatch_event('compositionend')
            expect(page.locator('#order-rows tr')).to_have_count(1)
            expect(page.locator('#order-rows')).to_contain_text('海棠')
            page.locator('#clear-search').click()
            expect(search).to_be_focused()
            expect(page.locator('#order-rows tr')).to_have_count(4)
            search.fill('不存在的客户')
            expect(page.locator('#no-results')).to_be_visible()
            page.locator('#reset-filters').click()
            page.locator('#status-filter').focus()
            page.keyboard.press('ArrowDown'); page.keyboard.press('Enter')
            expect(page.locator('#order-rows tr')).to_have_count(2)
            checks.append('IME search, immediate clear, empty recovery and native select keyboard')

            trigger = page.locator('#order-rows a').first
            trigger.click()
            expect(page.locator('#detail-dialog')).to_be_visible()
            expect(page.locator('#close-detail')).to_be_focused()
            page.locator('#detail-dialog summary').click()
            expect(page.locator('#detail-dialog')).to_contain_text('BleedBox')
            expect(page.locator('#detail-dialog')).to_contain_text('部件 2')
            page.screenshot(path=str(OUT / 'detail.png'))
            for _ in range(6):
                page.keyboard.press('Tab')
                assert page.evaluate("document.activeElement === document.querySelector('#detail-dialog') || document.querySelector('#detail-dialog').contains(document.activeElement)")
            page.keyboard.press('Escape')
            expect(page.locator('#detail-dialog')).not_to_be_visible()
            expect(trigger).to_be_focused()
            trigger.click()
            page.locator('#close-detail').click()
            expect(page.locator('#detail-dialog')).not_to_be_visible()
            expect(trigger).to_be_focused()
            checks.append('detail, per-part unknown state, PDF box metadata, modal keyboard and focus return')

            page.locator('[data-view="form"]').click()
            page.locator('#save-demo').click()
            expect(page.locator('#name-error')).to_be_visible()
            expect(page.locator('#customer-name')).to_be_focused()
            page.locator('#customer-name').fill('测试客户 <b>保持文字</b>')
            page.locator('#customer-note').fill('保留备注')
            page.locator('#contact-date').fill('2026-02-30')
            page.locator('#save-demo').click()
            expect(page.locator('#date-error')).to_be_visible()
            expect(page.locator('#customer-note')).to_have_value('保留备注')
            page.evaluate('window.scrollTo(0, 0)')
            page.screenshot(path=str(OUT / 'form-error.png'), full_page=True)
            page.locator('#contact-date').fill('2028-02-29')
            before = page.locator('#save-demo').bounding_box()
            page.locator('#save-demo').click()
            expect(page.locator('#save-demo')).to_be_disabled()
            busy = page.locator('#save-demo').bounding_box()
            assert before['width'] == busy['width'] and before['height'] == busy['height']
            expect(page.locator('#save-status')).to_contain_text('没有写入服务器')
            assert page.locator('#save-status b').count() == 0
            page.locator('#save-demo').click()
            page.locator('#customer-note').fill('等待期间的新修改')
            expect(page.locator('#save-status')).to_contain_text('尚未校验')
            checks.append('validation, date-only leap year, input retention, stable busy and text-safe feedback')

            page.locator('#customer-note').fill('未保存修改')
            page.locator('[data-view="orders"]').click()
            expect(page.locator('#discard-dialog')).to_be_visible()
            expect(page.locator('#keep-editing')).to_be_focused()
            page.locator('#keep-editing').click()
            expect(page.locator('#customer-note')).to_have_value('未保存修改')
            page.locator('[data-view="orders"]').click()
            page.locator('#discard-changes').click()
            expect(page.locator('#orders')).to_be_visible()
            checks.append('unsaved navigation keep/discard recovery')

            # A host element must render identically with and without the ERP sheets.
            page.evaluate("""() => {
              const probe = document.createElement('div'); probe.id='host-probe';
              probe.innerHTML='<button type="button">宿主按钮</button><input placeholder="宿主字段"><table><tbody><tr><td>宿主表格</td></tr></tbody></table>';
              document.body.append(probe);
            }""")
            measure = """() => [...document.querySelectorAll('#host-probe,#host-probe *')].map(e => {const s=getComputedStyle(e); return [e.tagName, s.color, s.backgroundColor, s.fontSize, s.padding, s.margin, s.border, s.width, s.height];})"""
            with_css = page.evaluate(measure)
            page.evaluate("document.querySelectorAll('link[href*=" + '"../assets/"' + "]').forEach(e => e.disabled=true)")
            assert page.evaluate(measure) == with_css
            page.evaluate("document.querySelectorAll('link[href*=" + '"../assets/"' + "]').forEach(e => e.disabled=false)")
            page.locator('#host-probe').evaluate('(e) => e.remove()')
            checks.append('ERP styles do not change host button/input/table computed styles')

            for width, height in [(1024, 768), (760, 640), (390, 844), (720, 500)]:
                page.set_viewport_size({'width': width, 'height': height})
                page.goto(base + '/preview/index.html')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                page.locator('[data-view="form"]').click()
                page.locator('#save-demo').scroll_into_view_if_needed()
                assert page.locator('#save-demo').bounding_box()['y'] >= 56
                if width == 390:
                    page.goto(base + '/preview/index.html')
                    page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
                checks.append(f'{width}x{height} reflow and long form action reachability')
            page.set_viewport_size({'width': 1440, 'height': 1000})
            page.goto(base + '/preview/index.html?mode=embedded')
            assert page.locator('main').bounding_box()['x'] == 24
            page.locator('[data-view="states"]').click()
            page.screenshot(path=str(OUT / 'states.png'), full_page=True)
            page.emulate_media(reduced_motion='reduce', forced_colors='active')
            assert page.locator('.apb-erp-busy-slot').last.evaluate('(e) => getComputedStyle(e).animationName') == 'none'
            checks.append('content-only mode, reduced motion and forced-colors render')
            assert not errors, errors
            assert not external, external
            assert not posts, posts
            checks.append('no JS errors, no external requests and no mutations')
            report.update(status='passed', external_requests=external, mutations=posts, js_errors=errors,
                          limits=['Chromium only; no Safari/Firefox/touch hardware or screen reader certification',
                                  '720x500 reflow approximates 200% viewport; not OS zoom certification',
                                  'No production APIs/auth/ERP CRUD/printing tested'])
            browser.close()
    except Exception as error:
        report.update(status='failed', error=str(error))
        raise
    finally:
        (OUT / 'browser.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        server.shutdown()
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
