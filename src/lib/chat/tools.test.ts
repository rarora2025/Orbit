import { describe, it, expect } from 'vitest';
import { CHAT_TOOLS, parseToolCall, describeAction } from './tools';

describe('CHAT_TOOLS', () => {
  it('every tool has a name + object parameters', () => {
    for (const t of CHAT_TOOLS) {
      expect(t.type).toBe('function');
      expect(typeof t.function.name).toBe('string');
      expect(t.function.parameters).toMatchObject({ type: 'object' });
    }
  });
});

describe('parseToolCall', () => {
  it('round-trips create_contact', () => {
    const a = parseToolCall('create_contact', JSON.stringify({ name: 'Jane Doe', company: 'Acme' }));
    expect(a).toMatchObject({ type: 'create_contact', args: { name: 'Jane Doe', company: 'Acme' } });
    expect(a!.id).toMatch(/^act_/);
  });

  it('requires the required fields', () => {
    expect(parseToolCall('create_contact', JSON.stringify({ company: 'Acme' }))).toBeNull();
    expect(parseToolCall('create_goal', JSON.stringify({}))).toBeNull();
    expect(parseToolCall('set_follow_up', JSON.stringify({ contactName: 'X' }))).toBeNull();
  });

  it('update_contact needs at least one field to change', () => {
    expect(parseToolCall('update_contact', JSON.stringify({ contactName: 'Harry' }))).toBeNull();
    const a = parseToolCall('update_contact', JSON.stringify({ contactName: 'Harry', linkedinUrl: 'https://linkedin.com/in/harry' }));
    expect(a).toMatchObject({ type: 'update_contact', args: { contactName: 'Harry', linkedinUrl: 'https://linkedin.com/in/harry' } });
    expect(describeAction(a!)).toBe('Update Harry · LinkedIn');
  });

  it('validates enum status', () => {
    expect(parseToolCall('set_status', JSON.stringify({ contactName: 'X', status: 'Bogus' }))).toBeNull();
    expect(parseToolCall('set_status', JSON.stringify({ contactName: 'X', status: 'Met' }))).toMatchObject({ type: 'set_status', args: { status: 'Met' } });
  });

  it('returns null on bad json or unknown tool', () => {
    expect(parseToolCall('create_goal', '{not json')).toBeNull();
    expect(parseToolCall('does_not_exist', '{}')).toBeNull();
  });

  it('describes actions for the confirm card', () => {
    const a = parseToolCall('create_goal', JSON.stringify({ title: 'Fundraising' }))!;
    expect(describeAction(a)).toBe('Create goal “Fundraising”');
  });
});
