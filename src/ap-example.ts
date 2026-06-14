// CAP Theorem - AP (Available + Partition Tolerant) Example
// This is an educational demonstration - not production-ready code
import express, { Request, Response } from 'express';
import http from 'http';

// Create three Express apps to simulate three distributed nodes
const app1 = express();
const app2 = express();
const app3 = express();

// Parse JSON request bodies
app1.use(express.json());
app2.use(express.json());
app3.use(express.json());

// Define data interfaces
interface VersionedData {
  value: string;
  version: number;
}

// Each node maintains its own state with version numbers for conflict resolution
let node1Data: VersionedData = { value: 'initial', version: 1 };
let node2Data: VersionedData = { value: 'initial', version: 1 };
let node3Data: VersionedData = { value: 'initial', version: 1 };

// Function to update data with a new version number
const updateData = (current: VersionedData, newValue: string): VersionedData => {
  return {
    value: newValue,
    version: current.version + 1
  };
};

// Conflict resolution - higher version wins
const mergeData = (a: VersionedData, b: VersionedData): VersionedData => {
  return a.version > b.version ? a : b;
};

// Asynchronous replication (doesn't wait for success)
const replicate = (fromPort: number, toPort: number, data: VersionedData): void => {
  const options: http.RequestOptions = {
    hostname: 'localhost',
    port: toPort,
    path: '/sync',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  
  const req = http.request(options);
  // Ignore errors - AP prioritizes availability over immediate consistency
  req.on('error', () => {});
  req.write(JSON.stringify(data));
  req.end();
};

// Node 1 endpoints
app1.get('/data', (req: Request, res: Response) => {
  // Always respond with local data
  res.json(node1Data);
});

app1.post('/data', (req: Request, res: Response) => {
  // Update local data immediately
  node1Data = updateData(node1Data, req.body.value);
  // Try to replicate to other nodes asynchronously
  replicate(4001, 4002, node1Data);
  replicate(4001, 4003, node1Data);
  // Respond immediately without waiting for replication
  res.json({ success: true, data: node1Data });
});

app1.post('/sync', (req: Request, res: Response) => {
  // Merge incoming data with local data
  node1Data = mergeData(node1Data, req.body);
  res.sendStatus(200);
});

// Node 2 endpoints
app2.get('/data', (req: Request, res: Response) => {
  res.json(node2Data);
});

app2.post('/data', (req: Request, res: Response) => {
  node2Data = updateData(node2Data, req.body.value);
  replicate(4002, 4001, node2Data);
  replicate(4002, 4003, node2Data);
  res.json({ success: true, data: node2Data });
});

app2.post('/sync', (req: Request, res: Response) => {
  node2Data = mergeData(node2Data, req.body);
  res.sendStatus(200);
});

// Node 3 endpoints
app3.get('/data', (req: Request, res: Response) => {
  res.json(node3Data);
});

app3.post('/data', (req: Request, res: Response) => {
  node3Data = updateData(node3Data, req.body.value);
  replicate(4003, 4001, node3Data);
  replicate(4003, 4002, node3Data);
  res.json({ success: true, data: node3Data });
});

app3.post('/sync', (req: Request, res: Response) => {
  node3Data = mergeData(node3Data, req.body);
  res.sendStatus(200);
});

// Start all three nodes
app1.listen(4001, () => console.log('Node 1 (AP) listening on port 4001'));
app2.listen(4002, () => console.log('Node 2 (AP) listening on port 4002'));
app3.listen(4003, () => console.log('Node 3 (AP) listening on port 4003'));
