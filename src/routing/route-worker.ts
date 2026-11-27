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

const scope = self as unknown as {
  postMessage(message: RouteWorkerResponse): void;
  addEventListener(type: 'message', listener: (message: MessageEvent<RouteWorkerRequest>) => void): void;
};

scope.addEventListener('message', (message) => {
  const { requestId, request } = message.data;
  scope.postMessage({ requestId, plan: solveRoute(request) });
});
