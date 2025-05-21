from . import db # Importa la instancia db de __init__.py
from sqlalchemy.dialects.postgresql import UUID, TEXT, BOOLEAN, INTEGER, TIMESTAMP, DATE, TIME, ARRAY
from sqlalchemy import UniqueConstraint, CheckConstraint
from datetime import datetime, timezone 
import uuid
from werkzeug.security import generate_password_hash, check_password_hash


# Helper para generar UUIDs por defecto
def generate_uuid():
    return str(uuid.uuid4())

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(TEXT, unique=True, nullable=False)
    password_hash = db.Column(TEXT, nullable=False)
    name = db.Column(TEXT, nullable=False)
    avatar_url = db.Column(TEXT, nullable=True)
    total_points = db.Column(INTEGER, default=0, nullable=False)
    level = db.Column(INTEGER, default=1, nullable=False)
    current_streak = db.Column(INTEGER, default=0, nullable=False)
    last_login_date = db.Column(DATE, nullable=True)
    created_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    quests = db.relationship('Quest', backref='user', lazy=True, cascade="all, delete-orphan")
    tags = db.relationship('Tag', backref='user', lazy=True, cascade="all, delete-orphan")
    pool_missions = db.relationship('PoolMission', backref='user', lazy=True, cascade="all, delete-orphan")
    scheduled_missions = db.relationship('ScheduledMission', backref='user', lazy=True, cascade="all, delete-orphan")
    habit_templates = db.relationship('HabitTemplate', backref='user', lazy=True, cascade="all, delete-orphan")
    habit_occurrences = db.relationship('HabitOccurrence', backref='user', lazy=True, cascade="all, delete-orphan")
    energy_logs = db.relationship('EnergyLog', backref='user', lazy=True, cascade="all, delete-orphan")

    # Métodos para el manejo de contraseñas
    def set_password(self, password):
        """Genera un hash de la contraseña y lo almacena."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifica la contraseña proporcionada contra el hash almacenado."""
        return check_password_hash(self.password_hash, password)

    # Placeholder para métodos de token de reseteo de contraseña (se implementarán más tarde)
    # def get_reset_password_token(self, expires_in=600):
    #     pass # Lógica para generar un token JWT específico para reseteo

    # @staticmethod
    # def verify_reset_password_token(token):
    #     pass # Lógica para verificar el token y devolver el ID de usuario
    
    def __repr__(self):
        return f'<User {self.email}>'

class Quest(db.Model):
    __tablename__ = 'quests'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    color = db.Column(TEXT, default='#FFFFFF', nullable=False)
    is_default_quest = db.Column(BOOLEAN, default=False, nullable=False)
    created_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    pool_missions = db.relationship('PoolMission', backref='quest', lazy=True, foreign_keys='PoolMission.quest_id')
    scheduled_missions = db.relationship('ScheduledMission', backref='quest', lazy=True, foreign_keys='ScheduledMission.quest_id')
    habit_templates = db.relationship('HabitTemplate', backref='quest', lazy=True, foreign_keys='HabitTemplate.quest_id')
    habit_occurrences = db.relationship('HabitOccurrence', backref='quest', lazy=True, foreign_keys='HabitOccurrence.quest_id')


    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_user_quest_name'),
        # La constraint UNIQUE(user_id) WHERE is_default_quest IS TRUE es más compleja
        # y se maneja mejor con un índice parcial o un trigger en la BD directamente.
        # SQLAlchemy no tiene un decorador simple para esto.
        # Por ahora, la lógica de negocio deberá asegurar esto.
        # Se podría usar un índice parcial así en Alembic:
        # op.create_index('idx_user_default_quest_unique', 'quests', ['user_id'], unique=True, postgresql_where=sa.text('is_default_quest IS TRUE'))
    )

    def __repr__(self):
        return f'<Quest {self.name}>'

class Tag(db.Model):
    __tablename__ = 'tags'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(TEXT, nullable=False)
    created_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_user_tag_name'),
    )

    def __repr__(self):
        return f'<Tag {self.name}>'

# Join Tables for Tags
pool_mission_tags_association = db.Table('pool_mission_tags', db.metadata,
    db.Column('pool_mission_id', UUID(as_uuid=True), db.ForeignKey('pool_missions.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', UUID(as_uuid=True), db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)

scheduled_mission_tags_association = db.Table('scheduled_mission_tags', db.metadata,
    db.Column('scheduled_mission_id', UUID(as_uuid=True), db.ForeignKey('scheduled_missions.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', UUID(as_uuid=True), db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)

habit_template_tags_association = db.Table('habit_template_tags', db.metadata,
    db.Column('habit_template_id', UUID(as_uuid=True), db.ForeignKey('habit_templates.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', UUID(as_uuid=True), db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)

class PoolMission(db.Model):
    __tablename__ = 'pool_missions'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    quest_id = db.Column(UUID(as_uuid=True), db.ForeignKey('quests.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    energy_value = db.Column(INTEGER, nullable=False)
    points_value = db.Column(INTEGER, nullable=False)
    status = db.Column(TEXT, nullable=False, default='PENDING') # PENDING, COMPLETED
    focus_status = db.Column(TEXT, nullable=False, default='ACTIVE') # ACTIVE, DEFERRED
    created_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tags = db.relationship('Tag', secondary=pool_mission_tags_association, backref=db.backref('pool_missions', lazy='dynamic'))

    __table_args__ = (
        CheckConstraint(status.in_(['PENDING', 'COMPLETED']), name='ck_pool_mission_status'),
        CheckConstraint(focus_status.in_(['ACTIVE', 'DEFERRED']), name='ck_pool_mission_focus_status'),
    )
    def __repr__(self):
        return f'<PoolMission {self.title}>'

class ScheduledMission(db.Model):
    __tablename__ = 'scheduled_missions'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    quest_id = db.Column(UUID(as_uuid=True), db.ForeignKey('quests.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    energy_value = db.Column(INTEGER, nullable=False)
    points_value = db.Column(INTEGER, nullable=False)
    start_datetime = db.Column(TIMESTAMP(timezone=True), nullable=False)
    end_datetime = db.Column(TIMESTAMP(timezone=True), nullable=False)
    status = db.Column(TEXT, nullable=False, default='PENDING') # PENDING, COMPLETED, SKIPPED
    created_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tags = db.relationship('Tag', secondary=scheduled_mission_tags_association, backref=db.backref('scheduled_missions', lazy='dynamic'))

    __table_args__ = (
        CheckConstraint(status.in_(['PENDING', 'COMPLETED', 'SKIPPED']), name='ck_scheduled_mission_status'),
    )
    def __repr__(self):
        return f'<ScheduledMission {self.title}>'

class HabitTemplate(db.Model):
    __tablename__ = 'habit_templates'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    quest_id = db.Column(UUID(as_uuid=True), db.ForeignKey('quests.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, nullable=True)
    default_energy_value = db.Column(INTEGER, nullable=False)
    default_points_value = db.Column(INTEGER, nullable=False)
    rec_by_day = db.Column(ARRAY(TEXT), nullable=True) # e.g., ['MO', 'WE', 'FR'] or ['DAILY'], ['WEEKLY']
    rec_start_time = db.Column(TIME(timezone=True), nullable=True)
    rec_duration_minutes = db.Column(INTEGER, nullable=True)
    rec_pattern_start_date = db.Column(DATE, nullable=False)
    rec_ends_on_date = db.Column(DATE, nullable=True)
    is_active = db.Column(BOOLEAN, default=True, nullable=False)
    created_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tags = db.relationship('Tag', secondary=habit_template_tags_association, backref=db.backref('habit_templates', lazy='dynamic'))
    occurrences = db.relationship('HabitOccurrence', backref='template', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<HabitTemplate {self.title}>'

class HabitOccurrence(db.Model):
    __tablename__ = 'habit_occurrences'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    habit_template_id = db.Column(UUID(as_uuid=True), db.ForeignKey('habit_templates.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False) # Denormalized for easier querying
    quest_id = db.Column(UUID(as_uuid=True), db.ForeignKey('quests.id', ondelete='SET NULL'), nullable=True) # Denormalized

    title = db.Column(TEXT, nullable=False) # Denormalized
    description = db.Column(TEXT, nullable=True) # Denormalized
    energy_value = db.Column(INTEGER, nullable=False) # Denormalized
    points_value = db.Column(INTEGER, nullable=False) # Denormalized

    scheduled_start_datetime = db.Column(TIMESTAMP(timezone=True), nullable=False)
    scheduled_end_datetime = db.Column(TIMESTAMP(timezone=True), nullable=False)
    status = db.Column(TEXT, nullable=False, default='PENDING') # PENDING, COMPLETED, SKIPPED
    actual_completion_datetime = db.Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(status.in_(['PENDING', 'COMPLETED', 'SKIPPED']), name='ck_habit_occurrence_status'),
    )
    def __repr__(self):
        return f'<HabitOccurrence {self.title} on {self.scheduled_start_datetime}>'


class EnergyLog(db.Model):
    __tablename__ = 'energy_log'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    source_entity_type = db.Column(TEXT, nullable=True) 
    source_entity_id = db.Column(UUID(as_uuid=True), nullable=True) 
    energy_value = db.Column(INTEGER, nullable=False)
    reason_text = db.Column(TEXT, nullable=True)
    is_active = db.Column(BOOLEAN, default=True, nullable=False) # NUEVO CAMPO
    created_at = db.Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False) # Usar lambda para asegurar nueva fecha en cada inserción

    __table_args__ = (
        CheckConstraint(source_entity_type.in_(['POOL_MISSION', 'SCHEDULED_MISSION', 'HABIT_OCCURRENCE', None]), name='ck_energy_log_source_type'),
    )
    def __repr__(self):
        return f'<EnergyLog User {self.user_id}: {self.energy_value}, Active: {self.is_active}>'
