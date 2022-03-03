/**
 * Validate basic batched multi-deletion functionality.
 *
 * @tags: [
 * ]
 */

(function() {
"use strict";
load("jstests/libs/analyze_plan.js");
load("jstests/libs/fail_point_util.js");

const conn = MongoRunner.runMongod();

const db = conn.getDB("batchMultiDeletesDB");
const coll = db.getCollection('batchMultiDeletesColl');
const collName = coll.getName();
const ns = coll.getFullName();

const collCount = 5017;  // Intentionally not a multiple of the default batch size.

coll.drop();
assert.commandWorked(
    coll.insertMany([...Array(collCount).keys()].map(x => ({_id: x, a: "a".repeat(1024)}))));

let batchUserMultiDeletesFailPoint = configureFailPoint(conn, "batchUserMultiDeletes", {ns: ns});
// Batched multi-deletion is only available for multi:true deletes.
assert.commandFailedWithCode(
    db.runCommand({delete: collName, deletes: [{q: {_id: {$gte: 0}}, limit: 1}]}), 6303800);

// Explain plan and executionStats.
{
    const expl = db.runCommand({
        explain: {delete: collName, deletes: [{q: {_id: {$gte: 0}}, limit: 0}]},
        verbosity: "executionStats"
    });
    assert.commandWorked(expl);

    assert(getPlanStage(expl, "BATCHED_DELETE"));
    assert.eq(0, expl.executionStats.nReturned);
    assert.eq(collCount, expl.executionStats.totalDocsExamined);
    assert.eq(collCount, expl.executionStats.totalKeysExamined);
    assert.eq(0, expl.executionStats.executionStages.nReturned);
    assert.eq(1, expl.executionStats.executionStages.isEOF);
}

// Actual deletion.
{
    assert.eq(collCount, coll.find().itcount());
    assert.commandWorked(coll.deleteMany({_id: {$gte: 0}}));
    assert.eq(0, coll.find().itcount());
}

batchUserMultiDeletesFailPoint.off();

MongoRunner.stopMongod(conn);
})();