import { Injectable } from "@nestjs/common";

@Injectable()
export class PredictionService {
    predict(project, producerLoad: number ) {
        const daysLeft = (project.dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

        let risk = 'Low';

        if (producerLoad >= 10 || daysLeft <= 2) {
            risk = 'High';
        }
        else if (producerLoad >= 4 || daysLeft <= 5) risk = 'Medium';
        
        return {
            predictedCompletion: project.dueAt,
            riskLevel: risk,
        };
    }
}