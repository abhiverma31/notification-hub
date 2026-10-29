import {
  Controller,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Path,
  Put,
  Body,
  Tags,
  Post,
  Get,
  Query,
  UploadedFile,
  Produces,
} from 'tsoa';
import { inject, injectable } from 'tsyringe';
import { UserService } from '../services/User';
import { NHRequest } from '../types/internal/NHRequest';
import { CreateDeviceTokenRequest } from '../types/request/CreateDeviceToken';
import { AuthSchemes } from '../middlewares/Authentication';
import { CreateUser } from '../types/request/CreateUser';
import fs from 'fs/promises';
import { logger } from '../utils/ServerLogger';
import { handleCsvFileUpload } from '../../shared-library/utils/files/handler';
import path from 'path';

@injectable()
@Route('api/user')
@Security(AuthSchemes.orgUser)
export class UserController extends Controller {
  constructor(@inject(UserService) private userService: UserService) {
    super();
  }

  /**
   * Register Device for Push Notification, this Api is called from the end user device, when he logs in for the first time to store the fcm token needed to send push notifications.
   * @summary Register Device for Push Notification
   * @param {string} id - The email id of the user
   * @param {CreateDeviceTokenRequest} fcmTokenJson - The request body containing fcm device token that will be stored in User Database.
   */
  @Put('{id}/device')
  @SuccessResponse('200', 'OK')
  @Response('400', 'User not found')
  @Tags('Register End User Device')
  public async registerDevice(
    @Request() request: NHRequest,
    @Path() id: string,
    @Body() fcmTokenJson: CreateDeviceTokenRequest,
  ): Promise<void> {
    await this.userService.registerDevice(request.user.organisation!._id!, id, fcmTokenJson);
  }

  /**
   * Create  End User who can recieve notifications.
   * @summary Create End User
   * @param {CreateUser} user - User Json Object conatining email, name( first and last name), phone Number.
   */
  @Security(AuthSchemes.orgOwner)
  @Post()
  @SuccessResponse('200', 'OK')
  @Tags('User')
  public async User(@Request() request: NHRequest, @Body() user: CreateUser) {
    const response = await this.userService.createUser(request.user.organisation!._id!, user);
    if (response) {
      return this.setStatus(200);
    } else {
      return this.setStatus(400);
    }
  }

  /**
   * Update End User who can recieve notifications.
   * @summary Update End User
   * @param {string} emailId - The email id of the user
   * @param {CreateUser} user - User Json Object conatining name( first and last name), phone Number.
   */
  @Security(AuthSchemes.orgOwner)
  @Post('{emailId}/update')
  @SuccessResponse('200', 'OK')
  @Tags('User')
  public async updateUser(@Request() request: NHRequest, @Path() emailId: string, @Body() user: CreateUser) {
    const response = await this.userService.updateUser(request.user.organisation!._id!, emailId, user);
    if (response) {
      return this.setStatus(200);
    } else {
      return this.setStatus(400);
    }
  }

  /**
   * Fetch users list to send notifications
   * @param page - current page number
   * @param itemsPerPage - number of users per page
   * @param {string} sortBy - field to sort by (default: updated_at)
   * @param {('asc' | 'desc')} sortOrder - sort order, either 'asc' or 'desc' (default: 'desc')
   **/
  @Security(AuthSchemes.orgOwner)
  @Security(AuthSchemes.frontendToken)
  @Get('/all')
  @SuccessResponse('200', 'OK')
  @Tags('List Users')
  public async getUserList(
    @Request() request: NHRequest,
    @Query() page: number,
    @Query() itemsPerPage: number,
    @Query() sortBy?: string,
    @Query() sortOrder?: 'asc' | 'desc',
  ) {
    const sortByParam = sortBy ?? 'updated_at';
    const sortOrderParam = sortOrder ?? 'desc';

    return await this.userService.getUserList(
      request.user.organisation!._id!,
      page!,
      itemsPerPage!,
      sortByParam,
      sortOrderParam,
    );
  }

  /**
   * Create Users from a CSV file.
   * @summary Upload CSV to create users
   * @param request
   * @param file - The CSV file containing user data.
   * @returns
   */
  @Security(AuthSchemes.orgOwner)
  @Security(AuthSchemes.frontendToken)
  @Post('import')
  @SuccessResponse('200', 'Users Created Successfully')
  @Response('400', 'Bad Request')
  @Response('500', 'Internal Server Error')
  @Tags('User')
  public async createUsersFromCsvController(
    @Request() request: NHRequest,
    @UploadedFile('file') file: Express.Multer.File,
  ): Promise<{ message: string; successCount?: number; details?: string }> {
    const { tempFilePath, error } = handleCsvFileUpload(file);

    if (error) {
      this.setStatus(400);
      logger.error('CSV upload failed: %s', error);

      return { message: error };
    }

    logger.info('Temporary file saved at:', tempFilePath);

    try {
      const { successCount } = await this.userService.createUsersFromCsv(tempFilePath, request.user.organisation!._id!);

      return {
        message: 'Users created successfully',
        successCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('Error while creating users from CSV:', errorMessage);
      this.setStatus(500);

      return { message: 'Failed to create users', details: errorMessage };
    } finally {
      try {
        fs.unlink(tempFilePath);
        logger.info('Temporary file deleted:', tempFilePath);
      } catch (unlinkError) {
        logger.error('Failed to delete temporary file:', unlinkError);
      }
    }
  }

  /**
   * Download CSV Template for user import.
   * This endpoint allows the front-end application to download a CSV template that can be used to import users.
   * @summary Download CSV Template
   */
  @Security(AuthSchemes.orgOwner)
  @Security(AuthSchemes.frontendToken)
  @Produces('text/csv')
  @Get('download-template')
  @SuccessResponse('200', 'OK')
  @Response('404', 'CSV Template Not Found')
  @Response('500', 'Internal Server Error')
  @Tags('User')
  public async downloadUserTemplate(): Promise<string> {
    const templatePath = path.resolve(process.cwd(), 'src/shared-library/assets/templates/user_import_template.csv');

    try {
      let fileContent = await fs.readFile(templatePath, 'utf-8');
      fileContent = fileContent.replace(/\n/g, ' ').trim();

      this.setHeader('Content-Type', 'text/csv');
      this.setHeader('Content-Disposition', 'attachment; filename="user_import_template.csv"');

      return fileContent;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.error('CSV template not found at:', templatePath);
        this.setStatus(404);
        throw new Error('CSV template not found');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error while downloading CSV template:', errorMessage);
        this.setStatus(500);
        throw new Error('Internal Server Error');
      }
    }
  }
}
