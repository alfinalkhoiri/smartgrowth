from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import RegistrationInviteCode, Role, User

# Public self-registration deliberately excludes the 'admin' role — admin
# accounts are provisioned via `createsuperuser` / Django admin only, so a
# public endpoint can't be used to mint one.
PUBLIC_ROLE_CHOICES = [choice for choice in Role.choices if choice[0] != Role.ADMIN]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=PUBLIC_ROLE_CHOICES, default=Role.ORANGTUA)
    # Only required when role=kader_nakes — that role sees every family's
    # data, so open self-registration into it isn't safe once orangtua
    # accounts (with a real privacy expectation) exist in the same system.
    # A single shared code is a deliberately low-friction gate: it stops
    # accidental/drive-by signups without needing an admin approval queue.
    invite_code = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email', 'role', 'phone_number', 'invite_code']
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs.get('role') == Role.KADER_NAKES:
            if attrs.get('invite_code') != RegistrationInviteCode.load().code:
                raise serializers.ValidationError({
                    'invite_code': 'Kode posyandu salah atau belum diisi. Minta kode ini ke koordinator posyandu Anda.'
                })
        return attrs

    def create(self, validated_data):
        validated_data.pop('invite_code', None)
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class InviteCodeSerializer(serializers.ModelSerializer):
    updated_by = serializers.CharField(source='updated_by.username', read_only=True, default=None)

    class Meta:
        model = RegistrationInviteCode
        fields = ['code', 'updated_at', 'updated_by']
        read_only_fields = fields
