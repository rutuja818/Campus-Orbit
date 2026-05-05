package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	"campus-orbit/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// ================= USER MODEL =================
type User struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	FullName   string             `bson:"fullName" json:"fullName"`
	Email      string             `bson:"email" json:"email"`
	Password   string             `bson:"passwordHash" json:"-"`
	Role       string             `bson:"role" json:"role"`
	Department string             `bson:"department" json:"department"`
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}

// ================= REGISTER =================
type RegisterReq struct {
	FullName   string `json:"fullName"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Role       string `json:"role"`
	Department string `json:"department"`
}

func Register(c *gin.Context) {
	var req RegisterReq

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)
	req.Password = strings.TrimSpace(req.Password)
	req.Department = strings.TrimSpace(req.Department)

	if req.FullName == "" || req.Email == "" || req.Password == "" || req.Role == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "All fields required"})
		return
	}

	// Gmail only
	if !strings.HasSuffix(req.Email, "@gmail.com") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only @gmail.com email allowed"})
		return
	}

	// Password: exactly 8 digits
	if len(req.Password) != 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be exactly 8 digits"})
		return
	}
	for _, ch := range req.Password {
		if ch < '0' || ch > '9' {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must contain digits only"})
			return
		}
	}

	// ✅ Allow roles
	if req.Role != "Student" && req.Role != "Staff" && req.Role != "HOD" && req.Role != "Principal" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	// ✅ Department Logic (UPDATED)
	if req.Role == "Student" || req.Role == "Staff" || req.Role == "HOD" {
		if req.Department == "" {
			req.Department = "Central"
		}
	} else {
		// Principal
		req.Department = "Central"
	}

	users := config.DB.Collection("users")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	count, _ := users.CountDocuments(ctx, bson.M{"email": req.Email})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	user := User{
		FullName:   req.FullName,
		Email:      req.Email,
		Password:   string(hash),
		Role:       req.Role,
		Department: req.Department,
		CreatedAt:  time.Now(),
	}

	_, err := users.InsertOne(ctx, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB insert failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Registered successfully"})
}

// ================= LOGIN =================
type LoginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(c *gin.Context) {
	var req LoginReq

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	users := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user User
	err := users.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	claims := jwt.MapClaims{
		"email": user.Email,
		"role":  user.Role,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	c.JSON(http.StatusOK, gin.H{
		"token": signed,
		"user": gin.H{
			"fullName":   user.FullName,
			"email":      user.Email,
			"role":       user.Role,
			"department": user.Department,
		},
	})
}

// ================= UPDATE PASSWORD =================
func UpdatePassword(c *gin.Context) {
	var req struct {
		Email       string `json:"email"`
		NewPassword string `json:"newPassword"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.NewPassword = strings.TrimSpace(req.NewPassword)

	if req.Email == "" || req.NewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and new password required"})
		return
	}

	if !strings.HasSuffix(req.Email, "@gmail.com") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only @gmail.com email allowed"})
		return
	}

	if len(req.NewPassword) != 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be exactly 8 digits"})
		return
	}
	for _, ch := range req.NewPassword {
		if ch < '0' || ch > '9' {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must contain digits only"})
			return
		}
	}

	users := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)

	result, err := users.UpdateOne(
		ctx,
		bson.M{"email": req.Email},
		bson.M{"$set": bson.M{"passwordHash": string(hash)}},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}
