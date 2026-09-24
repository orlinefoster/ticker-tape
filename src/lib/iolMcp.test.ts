import { describe, it, expect } from 'vitest';
import { IOLMcpClient } from './iolMcp';

describe('iolMcpClient', () => {
  it('instantiates and lists available MCP tools from IOL', async () => {
    const client = new IOLMcpClient();
    const tools = await client.listTools();

    expect(tools.length).toBeGreaterThan(0);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('iol_get_cuenta');
    expect(toolNames).toContain('iol_get_portafolio');
    expect(toolNames).toContain('iol_get_cotizacion');
  });

  it('calls iol_get_cuenta tool and retrieves valid balances', async () => {
    const client = new IOLMcpClient();
    const cuenta = (await client.callTool('iol_get_cuenta')) as any;

    expect(cuenta.disponibleArs).toBeGreaterThan(0);
    expect(cuenta.totalUsd).toBeGreaterThan(0);
  });

  it('synchronizes portfolio into typed IOLHolding structures', async () => {
    const client = new IOLMcpClient();
    const result = await client.syncPortfolio();

    expect(result.holdings.length).toBeGreaterThan(0);
    const spy = result.holdings.find((h) => h.symbol === 'SPY');
    expect(spy).toBeDefined();
    expect(spy?.assetType).toBe('CEDEAR');
    expect(spy?.nominalQuantity).toBe(180);
  });
});
