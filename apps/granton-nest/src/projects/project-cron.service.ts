import { Injectable, Logger }  from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "prisma/prisma.service";
import { ProjectStatus } from "@prisma/client";
import { NotificationService } from "src/notification/notification.service";

@Injectable()
export class ProjectCronService {
    private readonly logger = new Logger(ProjectCronService.name);

    constructor(
        private prisma: PrismaService,
        private notifications: NotificationService,
    ) {}


    // Runs every day at 9am
    @Cron('0 9 * * *')
    async remindProducerDay6() {
        const sixDaysAgo = new Date();
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

        const projects = await this.prisma.project.findMany({
            where: {
                startedAt: { lte: sixDaysAgo },
                status: {
                    in: [
                        ProjectStatus.FULLY_PAID,
                        ProjectStatus.RECORDING,
                        ProjectStatus.MIXING,
                    ],
                },
            },
            include: {
                producer: true,
            }
        });

        for (const project of projects) {
            await this.notifications.sendProducerReminder(project.producer.email, project.title);
        }

        this.logger.log(`Sent reminders for ${projects.length} projects that started 6 days ago.`);
    }
}
