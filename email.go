package handlers

import (
	"context"
	"fmt"
	"net/smtp"

	"campus-orbit/config"

	"go.mongodb.org/mongo-driver/bson"
)

// 🔹 send single email
func sendEmail(to, subject, body string) {

	from := "rutujasutar2110@gmail.com"
	password := "knie pruo ggon nuww" // 🔥 replace this

	msg := "From: " + from + "\n" +
		"To: " + to + "\n" +
		"Subject: " + subject + "\n\n" +
		body

	auth := smtp.PlainAuth("", from, password, "smtp.gmail.com")

	err := smtp.SendMail(
		"smtp.gmail.com:587",
		auth,
		from,
		[]string{to},
		[]byte(msg),
	)

	if err != nil {
		fmt.Println("❌ Email failed:", err)
	} else {
		fmt.Println("✅ Email sent to:", to)
	}
}

// 🔹 send email to all students
func SendEmailToStudents(n bson.M) {

	dept := n["dept"].(string)

	// ✅ CASE-INSENSITIVE role match
	query := bson.M{
		"role": bson.M{"$regex": "^student$", "$options": "i"},
	}

	// ✅ department filter
	if dept != "Central" {
		query["department"] = dept
	}

	fmt.Println("🔍 Query:", query)

	cursor, err := config.DB.Collection("users").Find(context.TODO(), query)
	if err != nil {
		fmt.Println("❌ DB error:", err)
		return
	}

	var users []bson.M
	cursor.All(context.TODO(), &users)

	fmt.Println("👥 Students found:", len(users))

	for _, u := range users {

		email, ok := u["email"].(string)
		if !ok {
			continue
		}

		subject := "📢 Upcoming Event Reminder"
		body := "Event: " + n["title"].(string) +
			"\nDate: " + n["date"].(string) +
			"\nDepartment: " + dept +
			"\n\nDon't miss it!"

		sendEmail(email, subject, body)
	}
}
