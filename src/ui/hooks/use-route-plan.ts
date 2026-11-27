import { useEffect, useRef, useState } from 'preact/hooks';
import type { RoutePlan, RouteRequest } from '../../routing';
import type { RouteWorkerRequest, RouteWorkerResponse } from '../../routing/route-worker';

export function useRoutePlan(request: RouteRequest): RoutePlan | null {
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    const worker = new Worker(new URL('../../routing/route-worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (message: MessageEvent<RouteWorkerResponse>) => {
      if (message.data.requestId === latestRequestIdRef.current) {
        setPlan(message.data.plan);
      }
    });
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    latestRequestIdRef.current += 1;
    const message: RouteWorkerRequest = { requestId: latestRequestIdRef.current, request };
    workerRef.current?.postMessage(message);
  }, [requestKey]);

  return plan;
}
