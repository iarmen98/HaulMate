import { solveRoute } from './solve-route';
import type { RoutePlan, RouteRequest } from './types';

export interface RouteWorkerRequest {
  requestId: number;
  request: RouteRequest;
}

export interface RouteWorkerResponse {
  requestId: number;
  plan: RoutePlan;
}

self.addEventListener('message', (message: MessageEvent<RouteWorkerRequest>) => {
  const { requestId, request } = message.data;
  const response: RouteWorkerResponse = { requestId, plan: solveRoute(request) };
  self.postMessage(response);
});
