/**
 * Tests explain when profileOperationResourceConsumptionMetrics is set to true and explain
 * verbosity is "executionStats" or "allPlansExecution".
 * @tags: [
 *   requires_replication,
 *   requires_sharding,
 *   requires_wiredtiger
 * ]
 */
(function() {
"use strict";
const dbName = jsTestName();
const collName = 'coll';

const runTest = (db) => {
    for (const verbosity of ["executionStats", "allPlansExecution"]) {
        jsTestLog("Testing with verbosity: " + verbosity);
        const coll = db[collName];
        coll.drop();
        const docs = [{a: 0, b: 0}, {a: 0, b: 0}, {a: 0, b: 0}];
        assert.commandWorked(coll.insertMany(docs));

        const result = assert.commandWorked(coll.find().explain(verbosity));
        assert(result.hasOwnProperty("executionStats"), result);
        const execStats = result.executionStats;
        assert(execStats.hasOwnProperty("operationMetrics"), execStats);
        const operationMetrics = execStats.operationMetrics;
        assert.eq(132, operationMetrics.docBytesRead);
        assert.eq(3, operationMetrics.docUnitsRead);

        const aggResult =
            assert.commandWorked(coll.explain(verbosity).aggregate({$project: {a: "$a"}}));
        assert(aggResult.hasOwnProperty("executionStats"), aggResult);
        const aggExecStats = aggResult.executionStats;
        assert(aggExecStats.hasOwnProperty("operationMetrics"), aggExecStats);
        const aggOperationMetrics = aggExecStats.operationMetrics;
        assert.eq(132, aggOperationMetrics.docBytesRead);
        assert.eq(3, aggOperationMetrics.docUnitsRead);

        assert.commandWorked(coll.createIndex({a: 1}));
        const idxFindResult = assert.commandWorked(coll.find({a: 0}).explain(verbosity));
        assert(idxFindResult.hasOwnProperty("executionStats"), idxFindResult);
        const idxFindExecutionStats = idxFindResult.executionStats;
        assert(idxFindExecutionStats.hasOwnProperty("operationMetrics"), idxFindExecutionStats);
        const idxFindOperationMetrics = idxFindExecutionStats.operationMetrics;
        assert.eq(132, idxFindOperationMetrics.docBytesRead);
        assert.eq(3, idxFindOperationMetrics.docUnitsRead);
        assert.eq(12, idxFindOperationMetrics.idxEntryBytesRead);
        assert.eq(3, idxFindOperationMetrics.idxEntryUnitsRead);
        assert.eq(4, idxFindOperationMetrics.cursorSeeks);
    }
};

const setParams = {
    profileOperationResourceConsumptionMetrics: true
};

jsTestLog("Testing standalone");
(function testStandalone() {
    const conn = MongoRunner.runMongod({setParameter: setParams});
    const db = conn.getDB(dbName);
    runTest(db);
    MongoRunner.stopMongod(conn);
})();

jsTestLog("Testing replica set");
(function testReplicaSet() {
    const rst = new ReplSetTest({nodes: 2, nodeOptions: {setParameter: setParams}});
    rst.startSet();
    rst.initiate();
    const db = rst.getPrimary().getDB(dbName);
    runTest(db);
    rst.stopSet();
})();
})();
