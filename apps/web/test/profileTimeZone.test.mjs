import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validTimeZone,timeZoneChoices} from '../src/profileTimeZone.mjs';
test('independent timezone choices prioritize Seoul/Tokyo and validate IANA zones',()=>{
 assert.deepEqual(timeZoneChoices().slice(0,2),['Asia/Seoul','Asia/Tokyo']);
 assert.equal(validTimeZone('America/New_York'),true);assert.equal(validTimeZone('Asia/Tokyo'),true);
 for(const zone of ['',null,'서울','Not/A_Zone'])assert.equal(validTimeZone(zone),false);
});
test('timezone picker and persistence have no archived career dependency',()=>{
 const picker=readFileSync(new URL('../src/TimeZonePicker.tsx',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(picker,/profileTimeZone\.mjs/);assert.doesNotMatch(picker,/coachTime|careerCoach/);
 assert.ok(main.includes("createTechFeedClient(supabase, userId)('timezone', { time_zone: zone })"));
 assert.doesNotMatch(main,/invoke\("career-coach"/);
});
test('todo completion patches one account-scoped feed article without a page reset',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const view=readFileSync(new URL('../src/TechFeedSection.tsx',import.meta.url),'utf8');
 assert.match(main,/setFeedLinkedTodo\(\{userId,articleId:feedPlanArticle.id,todoId:result.todo_id\}\)/);
 assert.doesNotMatch(main,/feedRefreshKey/);
 assert.match(view,/linkedTodo\?\.userId===userId/);
 assert.match(view,/todo_id:linkedTodo.todoId/);
 assert.doesNotMatch(view,/revision,linkedTodo/);
});
