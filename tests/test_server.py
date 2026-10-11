import json
from pathlib import Path
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
from app import Handler


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def post(self,path,payload,origin=None):
        headers={'Content-Type':'application/json'}
        if origin:
            headers['Origin']=origin
        req=urllib.request.Request(self.url+path,json.dumps(payload).encode(),headers)
        return urllib.request.urlopen(req)

    def test_dashboard_and_compare(self):
        with urllib.request.urlopen(self.url) as r:
            self.assertIn(b'Bear Trap Optimizer',r.read())
        for path, mime in [('/app.js','text/javascript'),('/ux.js','text/javascript'),('/styles.css','text/css'),('/ux.css','text/css')]:
            with urllib.request.urlopen(self.url+path+'?v=20261011-ux4') as asset:
                self.assertIn(mime,asset.headers['Content-Type'])
                self.assertGreater(len(asset.read()),0)
        with self.post('/api/compare',{'synthetic':{'n':4},'host_count':2}) as r:
            data=json.load(r)
        self.assertEqual(len(data['runs']),11)
        self.assertAlmostEqual(data['runs'][0]['total_damage'],2e9,delta=.001)

    def test_invalid_input_is_400(self):
        with self.assertRaises(urllib.error.HTTPError) as e:
            self.post('/api/compare',{'roster':[{'name':'Bad','troops':-1}]})
        self.assertEqual(e.exception.code,400)

    def test_cross_origin_is_403(self):
        with self.assertRaises(urllib.error.HTTPError) as e:
            self.post('/api/compare',{},origin='https://example.com')
        self.assertEqual(e.exception.code,403)


if __name__=='__main__':
    unittest.main()
