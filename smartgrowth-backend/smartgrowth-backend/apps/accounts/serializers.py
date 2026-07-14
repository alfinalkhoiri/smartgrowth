from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Role, User

# Public self-registration deliberately excludes the 'admin' role — admin
# accounts are provisioned via `createsuperuser` / Django admin only, so a
# public endpoint can't be used to mint one.
PUBLIC_ROLE_CHOICES = [choice for choice in Role.choices if choice[0] != Role.ADMIN]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=PUBLIC_ROLE_CHOICES, default=Role.KADER)

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email', 'role', 'phone_number']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
