import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));vi.mock('@/lib/auth',()=>({requireAccess:vi.fn()}));
import {loadMovementScreening} from '@/lib/movement-server';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn()};
const from=vi.fn(()=>query);
beforeEach(()=>{vi.clearAllMocks();query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValue(query);query.limit.mockReturnValue(query);query.maybeSingle.mockResolvedValue({data:null,error:null});});
it('blocks peer access in player presentation before any query, including a real admin preview',async()=>{
 const access={roles:['player'],athleteId:id,preview:{role:'player'},supabase:{from}} as unknown as Parameters<typeof loadMovementScreening>[0];
 await expect(loadMovementScreening(access,other,'PAC-0002')).rejects.toThrow('denied');expect(from).not.toHaveBeenCalled();
 expect(await loadMovementScreening(access,id,'PAC-0001')).toBeNull();expect(query.eq).toHaveBeenCalledWith('athlete_id',id);
});
it('fails on DB errors rather than silently declaring no screening',async()=>{
 query.maybeSingle.mockResolvedValue({data:null,error:{message:'private details'}});
 const access={roles:['coach'],athleteId:null,supabase:{from}} as unknown as Parameters<typeof loadMovementScreening>[0];
 await expect(loadMovementScreening(access,id,'PAC-0001')).rejects.toThrow('could not be loaded');
});
