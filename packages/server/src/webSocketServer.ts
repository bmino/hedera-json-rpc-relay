/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import Koa from 'koa';
import jsonResp from './koaJsonRpc/lib/RpcResponse';
import websockify from 'koa-websocket';
import { predefined } from '@hashgraph/json-rpc-relay';

export default (relay, register, logger) => {
    const app = websockify(new Koa(), {});
    const LOGGER_PREFIX = 'WebSocket:';

    app.ws.use((ctx) => {

        // FIXME
        ctx.websocket.id = relay.subs().generateId();
        logger.info(`${LOGGER_PREFIX} new connection ${ctx.websocket.id}`);

        ctx.websocket.on('message', async (msg) => {
            const request = JSON.parse(msg.toString('ascii'));
            const {method, params} = request;
            let response;

            if (method === 'eth_subscribe') {
                const event = params[0];
                const filters = params[1];
                let subscriptionId;

                if (event === 'logs') {
                    subscriptionId = relay.subs().subscribe(ctx.websocket, event, filters);
                }
                else if (event === 'newHeads') {
                    // not supported
                }
                else if (event === 'newPendingTransactions') {
                    // not supported
                }
                else {
                    // invalid event
                }

                response = jsonResp(request.id, null, subscriptionId);
            }
            else if (method === 'eth_unsubscribe') {
                const subId = params[0];
                logger.info(`${LOGGER_PREFIX} eth_unsubscribe ${subId} ${ctx.websocket.id}`);
                const result = relay.subs().unsubscribe(ctx.websocket, subId);
                response = jsonResp(request.id, null, result);
            }

            // Clients want to know the chainId after connecting
            else if (method === 'eth_chainId') {
                response = jsonResp(request.id, null, relay.eth().chainId());
            }
            else {
                response = jsonResp(request.id, predefined.INTERNAL_ERROR(), null);
            }

            ctx.websocket.send(JSON.stringify(response));
        });

        ctx.websocket.on('error', console.error);

        ctx.websocket.on('close', function () {
            relay.subs().unsubscribe(ctx.websocket);
            console.log('stopping client interval');
        });

    });

    return app;
};