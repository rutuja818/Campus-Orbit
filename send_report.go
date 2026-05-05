package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"gopkg.in/gomail.v2"
)

func SendReport(c *gin.Context) {
	to := c.PostForm("to")
	subject := c.PostForm("subject")
	message := c.PostForm("message")
	staffName := c.PostForm("staff_name")
	title := c.PostForm("title")

	if to == "" || subject == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing email or subject"})
		return
	}

	file, err := c.FormFile("pdf")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PDF file is required"})
		return
	}

	err = os.MkdirAll("uploads", os.ModePerm)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create uploads folder"})
		return
	}

	fileName := time.Now().Format("20060102150405") + "_" + filepath.Base(file.Filename)
	tempPath := filepath.Join("uploads", fileName)

	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded PDF"})
		return
	}

	defer os.Remove(tempPath)

	m := gomail.NewMessage()
	m.SetHeader("From", "yourgmail@gmail.com")
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)

	body := "Dear Coordinator,\n\n" +
		"Please find the attached event report.\n\n" +
		"Title of Activity: " + title + "\n" +
		"Submitted By: " + staffName + "\n\n" +
		"Remark: " + message + "\n\n" +
		"Regards,\n" + staffName

	m.SetBody("text/plain", body)
	m.Attach(tempPath)

	d := gomail.NewDialer("smtp.gmail.com", 587, "yourgmail@gmail.com", "your-app-password")

	if err := d.DialAndSend(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Report email sent successfully",
	})
}
