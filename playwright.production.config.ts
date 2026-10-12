import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/production',outputDir:'production-test-results',workers:1,timeout:45000,
 use:{baseURL:'http://127.0.0.1:5194',channel:'chrome',viewport:{width:1440,height:1000},locale:'ko-KR',timezoneId:'Asia/Seoul'},
 reporter:[['list'],['json',{outputFile:'production-test-results/results.json'}]],
 webServer:{command:'node tests/production-server.mjs',url:'http://127.0.0.1:5194',reuseExistingServer:false,timeout:30000},
});
