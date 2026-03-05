CREATE TYPE "public"."feedback_action" AS ENUM('accepted', 'dismissed');--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"recommendation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" "feedback_action" NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_content_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."content_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendationFeedback_recommendationId_idx" ON "recommendation_feedback" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "recommendationFeedback_userId_idx" ON "recommendation_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendationFeedback_action_idx" ON "recommendation_feedback" USING btree ("action");