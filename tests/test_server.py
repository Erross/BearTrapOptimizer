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
        for path, mime in [('/wave-planner.js','text/javascript'),('/app.js','text/javascript'),('/ux.js','text/javascript'),('/styles.css','text/css'),('/ux.css','text/css'),
                           ('/approaches.js','text/javascript'),('/strategy-builder.js','text/javascript'),('/profile-model.js','text/javascript'),('/approaches.css','text/css'),('/alliance-profiles.json','application/json')]:
            with urllib.request.urlopen(self.url+path+'?v=20261012-simple1') as asset:
                self.assertIn(mime,asset.headers['Content-Type'])
                self.assertGreater(len(asset.read()),0)
        with self.post('/api/compare',{'synthetic':{'n':4},'host_count':2}) as r:
            data=json.load(r)
        self.assertEqual(len(data['runs']),14)
        self.assertTrue(any(r['strategy']['cadence']=='groups' for r in data['runs']))
        self.assertAlmostEqual(data['runs'][0]['total_damage'],2e9,delta=.001)

    def test_wave_optimizer_endpoint(self):
        payload={'roster':[{'name':f'P{i}','troops':200001,'march_capacity':100000,
                           'rally_capacity':200001,'outbound_s':2,'return_s':2,'join_travel_s':2} for i in range(4)],
                 'mechanics':{'duration_s':180,'countdown_s':60},'host_count':4,
                 'normalization':{'enabled':False},'opening_limit_s':120}
        with self.post('/api/optimize_waves',payload) as r:
            result=json.load(r)
        self.assertEqual(result['best']['summary']['first_wave_missing_count'],0)

    def test_illustrative_profile_api_and_shared_static_data(self):
        with self.post('/api/alliance_roster',{'n':40,'profile':'top_four'}) as response:
            data=json.load(response)
        self.assertEqual(len(data['roster']),40)
        self.assertEqual([band['players'] for band in data['profile']['bands']],[8,18,10,4])
        with urllib.request.urlopen(self.url+'/alliance-profiles.json') as response:
            definitions=json.load(response)
        self.assertEqual(definitions['profiles']['top_four']['weights'],[.2,.45,.25,.1])

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
