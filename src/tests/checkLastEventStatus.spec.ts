import { set, reset } from 'mockdate'

type EventStatus = 'active' | 'inReview' | 'done'

class CheckLastEventStatus {
  constructor (private readonly loadLastEventRepository: LoadLastEventRepository) {}

  async execute ({ groupId }: { groupId: string }): Promise<EventStatus> {
    const event = await this.loadLastEventRepository.loadLastEvent({ groupId })
    if (!event) return 'done'
    const now = new Date()
    return event.endDate >= now ? 'active' : 'inReview'
  }
}

interface LoadLastEventRepository {
  loadLastEvent: (input: { groupId: string }) => Promise<{ endDate: Date } | undefined>
}

class LoadLastEventRepositorySpy implements LoadLastEventRepository {
  groupId?: string;
  callsCount = 0;
  output?: { endDate: Date};

  async loadLastEvent ({ groupId }: { groupId: string }): Promise<{ endDate: Date } | undefined> {
    this.groupId = groupId;
    this.callsCount++;
    return this.output
  }
}

type SutOutput = {
  sut: CheckLastEventStatus;
  loadLastEventRepository: LoadLastEventRepositorySpy
}

// Factory Pattern
const makeSut = (): SutOutput => {
  const loadLastEventRepository = new LoadLastEventRepositorySpy();
  const sut = new CheckLastEventStatus(loadLastEventRepository);
  return {
    sut,
    loadLastEventRepository
  }
}

describe('CheckLastEventStatus', () => {
  const groupId = 'any_group_id';

  beforeAll(() => {
    set(new Date())
  });

  afterAll(() => {
    reset()
  });

  it('should get the last event data', async () => {
    const { sut, loadLastEventRepository } = makeSut();

    await sut.execute({ groupId });

    expect(loadLastEventRepository.groupId).toBe('any_group_id');
    expect(loadLastEventRepository.callsCount).toBe(1);
  });

  it('should return status done when group has no event', async () => {
    const { sut, loadLastEventRepository } = makeSut();
    loadLastEventRepository.output = undefined;

    const status = await sut.execute({ groupId });

    expect(status).toBe('done');
  });

  it('should return status active when now is brefore event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();
    loadLastEventRepository.output = {
      // Data de encerramento do evento é uma data futura
      endDate: new Date(new Date().getTime() + 1)
    };

    const status = await sut.execute({ groupId });

    expect(status).toBe('active');
  });

  it('should return status active when now is the same as event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();
    loadLastEventRepository.output = {
      // Data de encerramento do evento é agora
      endDate: new Date()
    };

    const status = await sut.execute({ groupId });

    expect(status).toBe('active');
  });

  it('should return status inReview when now is after event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();
    loadLastEventRepository.output = {
      // Data de encerramento do evento é uma data passada
      endDate: new Date(new Date().getTime() - 1)
    };

    const status = await sut.execute({ groupId });

    expect(status).toBe('inReview');
  });
})