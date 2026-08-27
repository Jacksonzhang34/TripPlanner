import { supabase } from '@/lib/supabase';

import { leaveTrip } from './api';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

type DeleteChain = {
  delete: jest.Mock<DeleteChain, unknown[]>;
  eq: jest.Mock<DeleteChain, unknown[]>;
  select: jest.Mock<Promise<{ data: unknown; error: unknown }>, unknown[]>;
};

// Builds a chainable mock matching supabase.from('trip_members').delete().eq().eq().select()
// so tests can control what the terminal .select() resolves to.
function mockDeleteChain(result: { data: unknown; error: unknown }): DeleteChain {
  const chain: DeleteChain = {
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    select: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
}

const mockUser = { id: 'user-1' };

describe('leaveTrip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: mockUser } });
  });

  it('resolves when the delete removes a row', async () => {
    const chain = mockDeleteChain({ data: [{ trip_id: 't1', user_id: 'user-1' }], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(leaveTrip('t1')).resolves.toBeUndefined();
  });

  // This is the race from Task 3's ledger: the owner transfers ownership to
  // this same user in the same moment they try to leave, so the DELETE
  // silently affects 0 rows instead of raising a Postgres/PostgREST error.
  // leaveTrip() must surface that as a real failure, not succeed silently.
  it('throws when the delete affects no rows (lost race with a concurrent ownership transfer)', async () => {
    const chain = mockDeleteChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(leaveTrip('t1')).rejects.toThrow('not_a_member');
  });

  it('throws the underlying error when the delete itself fails', async () => {
    const chain = mockDeleteChain({ data: null, error: new Error('boom') });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(leaveTrip('t1')).rejects.toThrow('boom');
  });

  it('throws when not signed in', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });

    await expect(leaveTrip('t1')).rejects.toThrow('Not signed in');
  });
});
