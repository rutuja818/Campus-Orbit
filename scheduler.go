package handlers

import (
	"context"
	"fmt"
	"time"

	"campus-orbit/config"

	"go.mongodb.org/mongo-driver/bson"
)

func StartNotificationScheduler() {

	fmt.Println("🚀 Scheduler started...")

	for {
		now := time.Now()

		cursor, err := config.DB.Collection("notifications").Find(
			context.TODO(),
			bson.M{
				"notifyAt": bson.M{"$lte": now},
				"sent":     false,
			},
		)

		if err != nil {
			fmt.Println("❌ DB error:", err)
			continue
		}

		var notifications []bson.M
		cursor.All(context.TODO(), &notifications)

		fmt.Println("📢 Notifications found:", len(notifications))

		for _, n := range notifications {

			fmt.Println("📧 Sending email for:", n["title"])

			SendEmailToStudents(n)

			config.DB.Collection("notifications").UpdateOne(
				context.TODO(),
				bson.M{"_id": n["_id"]},
				bson.M{"$set": bson.M{"sent": true}},
			)
		}

		time.Sleep(10 * time.Second) // 🔥 fast testing
	}
}
