###########
# Builder #
###########

# pull official base image
FROM python:3.11.5-alpine as builder

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install psycopg2 dependencies
RUN apk update \
    && apk add postgresql-dev gcc python3-dev musl-dev

# install dependencies
COPY ./constraints.txt .
COPY ./requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /usr/src/app/wheels -r requirements.txt



#########
# Final #
#########

# pull official base image
FROM python:3.11.5-alpine

# Set up a user for the webapp
RUN mkdir -p /home/ctjot
RUN addgroup -S ctjot && adduser -S ctjot -G ctjot
ENV HOME=/home/ctjot
ENV APP_HOME=/home/ctjot/web
RUN mkdir $APP_HOME
RUN mkdir $APP_HOME/staticfiles
WORKDIR $APP_HOME

# Install dependencies
RUN apk update && apk add libpq
COPY --from=builder /usr/src/app/wheels /wheels
COPY --from=builder /usr/src/app/requirements.txt .
RUN pip install --no-cache /wheels/*

# Copy the web generator repo files into the container
COPY . $APP_HOME
RUN chmod +x $APP_HOME/deploy/entrypoint.sh

RUN chown -R ctjot:ctjot $APP_HOME

# TODO - Debug code - Remove this
RUN apk update && apk add bash

# switch to the ctjot user
USER ctjot

# Run the entrypoint script
ENTRYPOINT ["/home/ctjot/web/deploy/entrypoint.sh"]

