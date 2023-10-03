import { readFile, writeFile } from 'fs';
import CsvParser from './csv_parser';

const mockFilePath = './src/data.csv';
const parser = new CsvParser();
const DEFAULT_DURATION_MIN = 60;

type RobotData = {
  id: string;
  alias: string;
  type: string;
  used_by?: string;
  start_time?: number;
  end_time?: number;
};

class RobotManager {
  private data: RobotData[] = [];

  loadData = async () => {
    const data = await this.getRobotData();
    this.data = this.parseRobotData(data);

    const exist = this.checkAndClearExpiredRobots();
    if (exist) {
      await this.updateRobotData();
    }
  };

  printRobotsByType = (type: string) => {
    const pickedRobots = this.pickRobotsByType(type);
    if (!pickedRobots.length) {
      const availableRobotTypes = this.getAllRobotTypes();
      return this.printMessage(
        `unavailable type: (${type}) from [${availableRobotTypes.join(',')}]`
      );
    }
    this.printRobotUsageMessage(pickedRobots);
  };

  printAllRobots = () => {
    const robotTypes = this.getAllRobotTypes();

    robotTypes.forEach((type) => {
      const robotsByType = this.pickRobotsByType(type);
      this.printRobotUsageMessage(robotsByType);
    });
  };

  useRobotByType = async (
    type: string,
    user: string,
    durationMin: number = DEFAULT_DURATION_MIN
  ) => {
    const availableRobot = this.pickFreeRobot(type);
    if (!availableRobot) {
      return this.printMessage('availableRobot is not found');
    }
    await this.useRobot(availableRobot, user, durationMin);
  };

  useRobotById = async (
    id: string,
    user: string,
    durationMin: number = DEFAULT_DURATION_MIN
  ) => {
    const foundRobot = this.data.find((robot) => robot.id === id);
    if (!foundRobot) {
      return this.printMessage(`Can not find robot id ${id}`);
    }
    if (!!foundRobot.used_by) {
      return this.printRobotUsageMessage([foundRobot]);
    }
    await this.useRobot(foundRobot, user, durationMin);
  };

  useRobotByAlias = async (
    alias: string,
    user: string,
    durationMin: number = DEFAULT_DURATION_MIN
  ) => {
    const foundRobot = this.data.find((robot) => robot.alias === alias);
    if (!foundRobot) {
      return this.printMessage(`Can not find robot alias ${alias}`);
    }
    if (!!foundRobot.used_by) {
      return this.printRobotUsageMessage([foundRobot]);
    }
    await this.useRobot(foundRobot, user, durationMin);
  };

  private useRobot = async (
    robot: RobotData,
    user: string,
    durationMin: number = DEFAULT_DURATION_MIN
  ) => {
    const { startTime, endTime } = this.makeDurationTime(durationMin);
    robot.used_by = user;
    robot.start_time = startTime;
    robot.end_time = endTime;

    await this.updateRobotData();
    this.printRobotUsageMessage([robot]);
  };

  private getAllRobotTypes = () => {
    const robotTypes: string[] = [];

    this.data.forEach((robot) => {
      if (!robotTypes.includes(robot.type)) {
        robotTypes.push(robot.type);
      }
    });

    return robotTypes;
  };

  private getRobotData = async () => {
    return new Promise<string>((res, rej) => {
      readFile(mockFilePath, { encoding: 'utf-8' }, (err, data) => {
        if (err) return rej(err);
        res(data);
      });
    });
  };

  private updateRobotData = async () => {
    const updatedInput = parser.stringify(this.data);

    return new Promise<true>((res, rej) => {
      writeFile(mockFilePath, updatedInput, (err) => {
        if (err) return rej(err);
        res(true);
      });
    });
  };

  private parseRobotData = (input: string): RobotData[] => {
    return parser
      .parse(input)
      .map(({ used_by, start_time, end_time, ...required }) => ({
        ...required,
        used_by: used_by || undefined,
        start_time: start_time || undefined,
        end_time: end_time || undefined,
      }));
  };

  private printRobotUsageMessage = (data: RobotData[]) => {
    const result = data
      .map(({ id, alias, type, used_by, start_time, end_time }) => {
        const isNotUsed = !used_by;
        const usingMessage = `[${type}] ${id}(${alias}) is used by 💎${used_by}💎 ${new Date(
          start_time
        )
          .toTimeString()
          .slice(0, 8)} - ${new Date(end_time).toTimeString().slice(0, 8)}`;
        const notUsingMessage = `[${type}] ${id}(${alias}) is not used`;

        return isNotUsed ? notUsingMessage : usingMessage;
      })
      .join('\n');

    this.printMessage(result);
  };

  private pickRobotsByType = (type: string) =>
    this.data.filter((robot) => robot.type === type);

  private pickFreeRobot = (type: string) =>
    this.pickRobotsByType(type).find((robot) => !robot.used_by);

  private makeDurationTime = (durationMin: number = DEFAULT_DURATION_MIN) => {
    const now = new Date();
    const end = new Date();
    end.setMinutes(now.getMinutes() + durationMin);

    return { startTime: now.getTime(), endTime: end.getTime() };
  };

  private printMessage = (message: string) => console.log(message);

  private checkAndClearExpiredRobots = () => {
    const now = new Date();
    let existExpiredRobot = false;

    this.data
      .filter((robot) => !!robot.used_by)
      .forEach((robot) => {
        const endTime = new Date(robot.end_time);
        if (now > endTime) {
          existExpiredRobot = true;
          robot.used_by = undefined;
          robot.start_time = undefined;
          robot.end_time = undefined;
        }
      });

    return existExpiredRobot;
  };
}

const main = async () => {
  const robotManager = new RobotManager();
  await robotManager.loadData();

  const [, , functionName, arg1, arg2, arg3] = process.argv;

  switch (functionName) {
    case 'check_all':
      return robotManager.printAllRobots();
    case 'check_type':
      return robotManager.printRobotsByType(arg1);
    case 'use_robot_by_type':
      return robotManager.useRobotByType(
        arg1,
        arg2,
        arg3 ? Number(arg3) : undefined
      );
    case 'use_robot_by_id':
      return robotManager.useRobotById(
        arg1,
        arg2,
        arg3 ? Number(arg3) : undefined
      );
    case 'use_robot_by_alias':
      return robotManager.useRobotByAlias(
        arg1,
        arg2,
        arg3 ? Number(arg3) : undefined
      );
    default:
      throw new Error('unavailable function name');
  }
};

main();
