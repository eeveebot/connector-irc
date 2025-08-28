"use strict";

import winston from "winston";

export const eeveeLogo = `
            @
            *-
           #@#=-
           =#**==
           %#****#
            =****=
            %@**#@=   :  .#              *+=--=%=-
             @=@@@=@%=====-=*       ==@%******=#
               =@*=======--====% +=@@@@*****=#      :
                 ================#@@@@@@@%=+      @::*
                *==%===================*.      =::::::
                ==@@@=======+ ====     :+======--=::::
                ==*#=======%@@@==:   =+====+++====::::
              :@===========%@*===   +====++===+===:-:=
           -@...:====**=========:::=*+====++====+=++=
           =. ::::.#==========*:::::+**++++===++=+**
           :::.:...+:::::::::%::::::*=*****++******
            #::% ...::...::::::::::**==**********#
               %:::::.:...::::::::======+****#
                +:+::::::::=:=:#========
                 .=@:::::::*=====%======
                  *===*%=====#*** =====@
                   ==========***  %====
                   =========**%  *====
                  =-+=*==-=%     +=%=
                       %==#
`;

export const log = winston.createLogger();

if (process.env.NODE_ENV !== "production") {
  log.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: "HH:mm:ss",
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.colorize(),
        winston.format.printf((msg) => {
          return `${msg.timestamp} [${msg.level}] [${msg.producer}] ${msg.message}`;
        })
      ),
    })
  );
} else {
  log.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DDTHH:mm:ssZ",
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
    })
  );
}
