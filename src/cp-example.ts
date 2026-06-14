// CAP Theorem - CP (Consistent + Partition Tolerant) Example
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
interface Data {
  value: string;
}

interface PartitionRequest {
  partitioned: boolean;
}

// Shared state (in a real system, each node would have its own storage)
let data: Data = { value: 'initial' };
// Simulate whether a network partition is occurring
let isPartitioned: boolean = false;

// Node 1 - Leader node that handles write requests
app1.get('/data', (req: Request, res: Response) => {
  // Return current data
  res.json(data);
});

// Write endpoint - CP prioritizes consistency
app1.post('/data', (req: Request, res: Response) => {
  // Update local data first
  data.value = req.body.value;
  
  // If partitioned, reject write to maintain consistency
  if (isPartitioned) {
    return res.status(503).json({ error: 'System is partitioned, cannot ensure consistency' });
  }
  
  // Function to replicate data to another node
  const replicateToNode = (port: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: 'localhost',
        port: port,
        path: '/replicate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) resolve();
        else reject(new Error('Replication failed'));
      });
      
      req.on('error', reject);
      req.write(JSON.stringify(data));
      req.end();
    });
  };
  
  // Wait for replication to ALL nodes before responding (consistency guarantee)
  Promise.all([replicateToNode(3002), replicateToNode(3003)])
    .then(() => res.json({ success: true, data }))
    .catch(err => res.status(503).json({ error: 'Failed to replicate to all nodes' }));
});

// Node 2 - Follower node that accepts replication
app2.post('/replicate', (req: Request, res: Response) => {
  data = req.body;
  res.sendStatus(200);
});

app2.get('/data', (req: Request, res: Response) => {
  res.json(data);
});

// Node 3 - Follower node that accepts replication
app3.post('/replicate', (req: Request, res: Response) => {
  data = req.body;
  res.sendStatus(200);
});

app3.get('/data', (req: Request, res: Response) => {
  res.json(data);
});

// Endpoint to simulate network partition
app1.post('/partition', (req: Request<{}, {}, PartitionRequest>, res: Response) => {
  isPartitioned = req.body.partitioned;
  res.json({ isPartitioned });
});

// Start all three nodes
app1.listen(3001, () => console.log('Node 1 (CP Leader) listening on port 3001'));
app2.listen(3002, () => console.log('Node 2 (CP Follower) listening on port 3002'));
app3.listen(3003, () => console.log('Node 3 (CP Follower) listening on port 3003'));
