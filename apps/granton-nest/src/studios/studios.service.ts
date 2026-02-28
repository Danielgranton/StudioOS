
import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStudioDto } from "./dto/create-studio.dto";
import { UpdateStudioDto } from "./dto/update-studio.dto";


@Injectable()
export class StudiosService {
    constructor(private prisma: PrismaService) {}

    async create(userId: number, dto: CreateStudioDto) {
        return this.prisma.studio.create({
            data: {
                ...dto,
                ownerId: userId,
            },
        });
    }

    async update(studioId: string, userId: number, dto: UpdateStudioDto) {
        const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });

        if (!studio || studio.ownerId !== userId){
            throw new ForbiddenException('Not allowed');
        }

        return this.prisma.studio.update({
            where: { id: studioId },
            data: dto,
        });
    
    }

    findById(id: string) {
        return this.prisma.studio.findUnique({ where : { id }});
    }

    findAll(){
        return this.prisma.studio.findMany();
    }
}
