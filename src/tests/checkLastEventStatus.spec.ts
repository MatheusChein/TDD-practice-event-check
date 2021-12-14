import { set, reset } from 'mockdate'

class EventStatus {
  status: 'active' | 'inReview' | 'done';

  constructor (event?: LoadEventOutput) {
    if (!event) {
      this.status = 'done';
      return;
    }

    const now = new Date();
    if (event.endDate >= now) {
      this.status = 'active';
      return
    }

    const reviewDurationInMs = event.reviewDurationInHours * 60 * 60 * 1000
    const reviewDate = new Date(event.endDate.getTime() + reviewDurationInMs)
    this.status = now <= reviewDate ? 'inReview' : 'done'
  }
}

class CheckLastEventStatus {
  constructor (private readonly loadLastEventRepository: LoadLastEventRepository) {}

  async execute ({ groupId }: { groupId: string }): Promise<EventStatus> {
    const event = await this.loadLastEventRepository.loadLastEvent({ groupId });
    return new EventStatus(event)
  }
}

type LoadEventOutput = {
  endDate: Date;
  reviewDurationInHours: number
}

interface LoadLastEventRepository {
  loadLastEvent: (input: { groupId: string }) => Promise<LoadEventOutput | undefined>
}

class LoadLastEventRepositorySpy implements LoadLastEventRepository {
  groupId?: string;
  callsCount = 0;
  output?: LoadEventOutput;

  setEndDateAfterNow(): void {
    this.output = {
      // Data de encerramento do evento é uma data futura
      endDate: new Date(new Date().getTime() + 1),
      reviewDurationInHours: 1
    };
  }

  setEndDateEqualToNow(): void {
    this.output = {
      // Data de encerramento do evento é agora
      endDate: new Date(),
      reviewDurationInHours: 1
    };
  } 

  setEndDateBeforeNow(): void {
    this.output = {
      // Data de encerramento do evento é uma data passada
      endDate: new Date(new Date().getTime() - 1),
      reviewDurationInHours: 1
    };
  } 

  async loadLastEvent ({ groupId }: { groupId: string }): Promise<LoadEventOutput | undefined> {
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

    const { status } = await sut.execute({ groupId });

    expect(status).toBe('done');
  });

  it('should return status active when now is brefore event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();
    loadLastEventRepository.setEndDateAfterNow()

    const { status } = await sut.execute({ groupId });

    expect(status).toBe('active');
  });

  it('should return status active when now is equal to the event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();
    loadLastEventRepository.setEndDateEqualToNow()

    const { status } = await sut.execute({ groupId });

    expect(status).toBe('active');
  });

  it('should return status inReview when now is after event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();
    loadLastEventRepository.setEndDateBeforeNow()

    const { status } = await sut.execute({ groupId });

    expect(status).toBe('inReview');
  });

  it('should return status inReview when now is before review end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();

    const reviewDurationInHours = 1;
    const reviewDurationInMs = reviewDurationInHours * 60 * 60 * 1000;

    loadLastEventRepository.output = {
      endDate: new Date(new Date().getTime() - reviewDurationInMs + 1),
      reviewDurationInHours
    }

    const { status } = await sut.execute({ groupId });

    expect(status).toBe('inReview');
  });

  it('should return status inReview when now is equal to review end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();

    const reviewDurationInHours = 1;
    const reviewDurationInMs = reviewDurationInHours * 60 * 60 * 1000;

    loadLastEventRepository.output = {
      endDate: new Date(new Date().getTime() - reviewDurationInMs),
      reviewDurationInHours
    }

    const { status } = await sut.execute({ groupId });

    expect(status).toBe('inReview');
  });

  it('should return status done when now is after review end time', async () => {
    const { sut, loadLastEventRepository } = makeSut();

    const reviewDurationInHours = 1;
    const reviewDurationInMs = reviewDurationInHours * 60 * 60 * 1000;

    loadLastEventRepository.output = {
      endDate: new Date(new Date().getTime() - reviewDurationInMs - 1),
      reviewDurationInHours
    }

    const { status } = await sut.execute({ groupId });

    expect(status).toBe('done');
  });
})